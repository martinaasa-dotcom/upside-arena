import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { KNOWN_REASONS } from "@/app/auth/error/page";

/*
  Every way the app can refuse a sign-in has to say something useful.

  A reason with no message falls back to "something went wrong", which is the
  least helpful thing to show somebody who cannot get into their account. This
  drifts the moment a new failure is added, so it is checked against the
  source rather than remembered.
*/

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(entry) ? [path] : [];
  });
}

const emitted = new Set<string>();

// Redirects, from anywhere in the app.
for (const file of sourceFiles("src")) {
  for (const match of readFileSync(file, "utf8").matchAll(
    /auth\/error\?reason=([a-z-]+)/g
  )) {
    emitted.add(match[1]);
  }
}

/*
  And the ones the Google handshake returns as a value rather than writing
  into a url. Scoped to the auth code: "reason" is a common enough field name
  that scanning the whole tree picks up coin ledger entries and settlement
  outcomes, which have nothing to do with signing in.
*/
for (const file of [...sourceFiles("src/lib/auth"), ...sourceFiles("src/app/auth")]) {
  for (const match of readFileSync(file, "utf8").matchAll(
    /reason:\s*"([a-z-]+)"/g
  )) {
    emitted.add(match[1]);
  }
}

describe("the sign-in error page", () => {
  it("finds the reasons the code emits, so this test is not vacuous", () => {
    expect(emitted.size).toBeGreaterThan(3);
  });

  it("has something to say about every one of them", () => {
    const missing = [...emitted].filter((r) => !KNOWN_REASONS.includes(r));
    expect(missing, `no message written for: ${missing.join(", ")}`).toEqual([]);
  });

  it("carries no message for a reason nothing can produce", () => {
    // A stale entry is not harmful, but it is a claim about the code that has
    // stopped being true, and those are worth noticing.
    const stale = KNOWN_REASONS.filter((r) => !emitted.has(r));
    expect(stale, `nothing emits: ${stale.join(", ")}`).toEqual([]);
  });
});
