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
  it("is keyed on the account it belongs to", () => {
    // The cached function has to take the id, or its key is the same for all.
    expect(SOURCE).toMatch(/async function readProfile\(\s*userId: string/);

    const body = SOURCE.slice(SOURCE.indexOf("async function readProfile("));
    expect(body).toContain('"use cache: private"');
    expect(body).toMatch(/cacheTag\(sessionTag\(userId\)\)/);
  });

  it("does not cache the answer to who is asking", () => {
    /*
      identify() is a signature check against a token already in hand. It is
      the one answer here that must be settled on every request, and caching
      it would mean a token that has been revoked still opening rooms.
    */
    const identify = SOURCE.slice(
      SOURCE.indexOf("async function identify("),
      SOURCE.indexOf("async function readProfile(")
    );

    expect(identify).not.toContain("use cache");
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
