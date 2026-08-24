import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

/*
  Turning the emails off from inside the email.

  The link used to go to /profile, which is behind a sign-in, so somebody who
  had stopped using Arena and wanted the mail to stop was asked to sign back
  into an account they had left. What they actually press is the button that
  says spam, and one of those costs the sending domain more than a hundred
  quiet unsubscribes.
*/

vi.stubEnv("UNSUBSCRIBE_SECRET", "a secret for the test");
vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://arena.example");

const { unsubscribeUrlFor, userFromUnsubscribe } = await import(
  "@/lib/notify/unsubscribe"
);

const ANA = "aaaaaaaa-0000-0000-0000-000000000001";
const BEN = "bbbbbbbb-0000-0000-0000-000000000002";

function paramsOf(url: string) {
  return new URL(url).searchParams;
}

beforeEach(() => {
  vi.stubEnv("UNSUBSCRIBE_SECRET", "a secret for the test");
});

describe("the link in the mail", () => {
  it("carries who it is for and proof of it", () => {
    const url = unsubscribeUrlFor(ANA);
    expect(url).toBeTruthy();

    const params = paramsOf(url as string);
    expect(params.get("u")).toBe(ANA);
    expect(params.get("s")).toBeTruthy();
    expect(url).toContain("https://arena.example/api/unsubscribe");
  });

  it("is the same link every time, so an old email still works", () => {
    // No expiry, deliberately. A two year old email is exactly the one
    // somebody is most likely to unsubscribe from, and a link that answers
    // "this has expired" to that person has failed at its only job.
    expect(unsubscribeUrlFor(ANA)).toBe(unsubscribeUrlFor(ANA));
  });

  it("comes back to the person it was made for", () => {
    const params = paramsOf(unsubscribeUrlFor(ANA) as string);
    expect(userFromUnsubscribe(params.get("u"), params.get("s"))).toBe(ANA);
  });

  it("will not turn off somebody else's mail", () => {
    // Ana's signature against Ben's id. Without the check this is how one
    // person unsubscribes another.
    const params = paramsOf(unsubscribeUrlFor(ANA) as string);
    expect(userFromUnsubscribe(BEN, params.get("s"))).toBeNull();
  });

  it("refuses a signature that has been edited", () => {
    const params = paramsOf(unsubscribeUrlFor(ANA) as string);
    const signature = params.get("s") as string;
    const edited = `${signature.slice(0, -1)}${signature.endsWith("A") ? "B" : "A"}`;
    expect(userFromUnsubscribe(ANA, edited)).toBeNull();
  });

  it("refuses a missing one, rather than treating absence as agreement", () => {
    expect(userFromUnsubscribe(ANA, null)).toBeNull();
    expect(userFromUnsubscribe(ANA, "")).toBeNull();
    expect(userFromUnsubscribe(null, "anything")).toBeNull();
  });

  it("signs nothing at all when there is no key to sign with", () => {
    // An unset variable must never be the thing that opens something. With no
    // key, a forged link would let a stranger turn off a stranger's mail, so
    // there is no link and no header.
    vi.stubEnv("UNSUBSCRIBE_SECRET", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    expect(unsubscribeUrlFor(ANA)).toBeNull();
    expect(userFromUnsubscribe(ANA, "anything")).toBeNull();
  });
});

describe("what the endpoint does with it", () => {
  const route = readFileSync("src/app/api/unsubscribe/route.ts", "utf8");
  const send = readFileSync("src/lib/notify/send.ts", "utf8");
  const session = readFileSync("src/lib/supabase/session.ts", "utf8");

  it("changes nothing on a GET", () => {
    /*
      Mail scanners, link previewers and corporate gateways fetch every URL in
      a message before anybody reads it. An unsubscribe that fires on a fetch
      is one that happens to people who never asked.
    */
    const get = route.slice(
      route.indexOf("export async function GET"),
      route.indexOf("export async function POST")
    );

    expect(get).not.toContain("saveNotificationSettings");
    // It offers the button instead, which posts back to the same link.
    expect(get).toContain("actionFor(");
    expect(route).toContain('<form method="post"');
  });

  it("turns the emails off on a POST, and only the emails", () => {
    const post = route.slice(route.indexOf("export async function POST"));
    expect(post).toContain("saveNotificationSettings(userId, { email: false })");
    // Browser notifications are a different channel and a different consent.
    expect(post).not.toContain("push: false");
  });

  it("builds the form's target rather than echoing the address bar", () => {
    /*
      Only `u` and `s` are ever checked, so anything else in the query string
      is a stranger's text. Written back into the page it would be their HTML
      on our origin, with a valid signature attached to it.
    */
    expect(route).toContain("new URLSearchParams({ u: userId, s: signature })");
    expect(route).not.toContain("request.nextUrl.search}`");
  });

  it("says so when the save did not happen", () => {
    // A page that says "done" while the setting is unchanged is how somebody
    // ends up reporting the next email as spam.
    expect(route).toContain("That did not save");
  });

  it("is reachable without a session, because that is the whole point", () => {
    expect(session).toContain('"/api/unsubscribe"');
  });

  it("tells a mail client it may do it without asking", () => {
    expect(send).toContain('"List-Unsubscribe-Post": "List-Unsubscribe=One-Click"');
  });

  it("does not make that claim about the profile page", () => {
    // The fallback link is a sign-in page. A one-click header on it produces
    // a button that appears to work and does not, which is worse than none.
    expect(send).toContain("...(signed ? {");
  });
});
