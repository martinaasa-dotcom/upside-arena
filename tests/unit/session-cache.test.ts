import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/*
  The session is cached, and a cache is somewhere two people can meet.

  A cache key is built from a function's arguments. Cookies read inside the
  body are not part of it, so a cached read of "the current player's profile"
  that takes no arguments has one key for everybody: two accounts used from
  the same browser inside the stale window are the same entry. That is one
  player wearing another's name on Home, and on the metrics page it is one
  player seeing what only an owner is allowed to see.

  It is not a failure any test of behaviour would catch, because it needs two
  sign-ins and a clock. So it is checked here as a property of the source: the
  cached read takes the account it is for, and the answer to who that is comes
  from a signature check that is never itself cached.
*/

const SOURCE = readFileSync(
  path.join(__dirname, "..", "..", "src", "lib", "profile.ts"),
  "utf8"
);

describe("the cached session", () => {
  it("caches the cookie read, not only the row that follows it", () => {
    /*
      The whole point, and the thing four attempts got wrong.

      Reading a cookie is a runtime API, so a function that reads one cannot be
      prerendered -- and every room begins by awaiting this one. Caching the
      profile row while leaving the cookie read outside it left the root of
      every room dynamic, and every cached read behind that root still arrived
      after the tap. Adding a single cookies() call to this function is enough
      to move /home from static to partially prerendered, which is how it was
      finally found.

      So the directive has to be on the function that reads the cookie, not on
      something it calls afterwards.
    */
    const body = SOURCE.slice(SOURCE.indexOf("async function readSession("));

    expect(body).toMatch(/^ {2}"use cache: private";$/m);
    expect(body).toMatch(/cacheTag\(sessionTag\(user\.id\)\)/);
  });

  it("still verifies the token rather than trusting the cookie", () => {
    /*
      Identity is settled by checking a signature, not by reading what a cookie
      claims. That is true whether or not the answer is then cached, and it is
      the line that must never move: reading the cookie and believing it would
      be the insecure version of all of this.
    */
    const identify = SOURCE.slice(
      SOURCE.indexOf("async function identify("),
      SOURCE.indexOf("const STUB_SESSION")
    );

    expect(identify).toContain("getClaims()");
    expect(identify).toContain("getUser()");
  });

  it("is not what keeps anybody out", () => {
    /*
      The reason caching identity is safe to do at all, written down where
      somebody about to worry about it will find it.

      A private cache entry lives in the browser that asked, is never stored on
      a server, is never shared between people, and does not survive a page
      load -- and every way into this app as somebody else is a page load. The
      lock is proxy.ts, which reads the cookie itself on every request and is
      not cached. This check holds that division in place.
    */
    const proxy = readFileSync(
      path.join(__dirname, "..", "..", "src", "lib", "supabase", "session.ts"),
      "utf8"
    );

    expect(proxy).not.toContain("use cache");
    expect(proxy).toContain("getClaims()");
  });

  it("gives the writers a handle to drop it with", () => {
    // Both writers import this. A tag nobody can name is a cache nobody can
    // clear, and the onboarding gate reads this row to decide where to send
    // somebody who has just finished onboarding.
    expect(SOURCE).toMatch(/export function sessionTag\(userId: string\)/);
  });
});

describe("the two places a profile is written", () => {
  const writers = [
    ["onboarding", path.join(__dirname, "..", "..", "src", "app", "onboarding", "actions.ts")],
    ["profile", path.join(__dirname, "..", "..", "src", "app", "(app)", "profile", "actions.ts")],
  ] as const;

  it.each(writers)("%s drops the cached session after saving", (_name, file) => {
    const source = readFileSync(file, "utf8");

    /*
      Onboarding is the one that bites. It writes onboarded_at, and the
      layout asks this same cached row whether onboarding is done before it
      lets anybody into a room -- so without this the player is sent straight
      back to the screen they just finished, out of a cache, in a loop.
    */
    expect(source).toContain('from "@/lib/profile"');
    expect(source).toMatch(/updateTag\(sessionTag\(user\.id\)\)/);
  });
});
