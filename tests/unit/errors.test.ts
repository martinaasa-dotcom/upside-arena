import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { readMessage } from "@/lib/errors";

/*
  What a failure is allowed to say about itself.

  Two of these are privacy rather than tidiness, and both would be easy to
  undo by accident. A stack trace turns one bug into a hundred fingerprints
  and is a map of the source besides. A query string carries invite codes and
  share tokens, which is precisely the sort of thing that must not end up in
  a log of what broke.
*/

describe("reading a message off a failure", () => {
  it("keeps the first line and drops the stack under it", () => {
    const error = new Error("Cannot read properties of null");
    error.stack = "Error: Cannot read properties of null\n    at Home (page.tsx:12:9)";
    expect(readMessage(error)).toBe("Cannot read properties of null");
  });

  it("takes the first line of a multi-line message too", () => {
    expect(readMessage(new Error("first line\nsecond line"))).toBe("first line");
  });

  it("cuts a message longer than a failure needs", () => {
    expect(readMessage(new Error("x".repeat(900)))).toHaveLength(300);
  });

  it("says something rather than nothing when there is nothing to say", () => {
    // An empty row would be a failure nobody can look for.
    expect(readMessage(new Error(""))).toBe("an error with nothing to say");
    expect(readMessage(undefined)).toBe("an error with nothing to say");
    expect(readMessage({ weird: true })).toBe("an error with nothing to say");
  });

  it("takes a plain string, because not everything thrown is an Error", () => {
    expect(readMessage("something went wrong")).toBe("something went wrong");
  });
});

describe("what the endpoint will write down", () => {
  const route = readFileSync("src/app/api/error/route.ts", "utf8");
  const reporter = readFileSync("src/lib/report-error.ts", "utf8");
  const session = readFileSync("src/lib/supabase/session.ts", "utf8");

  it("throws away everything after the question mark", () => {
    // An invite code and a share token both live in one.
    expect(route).toContain('input.at.split("?")[0]');
  });

  it("needs a session, and is not on the list that skips one", () => {
    expect(route).toContain("supabase.auth.getUser()");
    expect(route).toContain("status: 401");
    expect(session).not.toContain('"/api/error"');
  });

  it("never writes down who it was", () => {
    // The session is a gate, not a field. `user` is read to refuse a
    // stranger and must not travel any further than that.
    expect(route).not.toMatch(/user\.id/);
    expect(route).toContain("The session is a gate, not a field");
  });

  it("caps what one report can be", () => {
    expect(route).toContain("MAX_BODY");
    expect(route).toContain("status: 413");
  });

  it("sends no stack from the browser, and survives the tab closing", () => {
    expect(reporter).toContain("keepalive: true");
    expect(reporter).not.toContain("error.stack");
  });

  it("cannot turn one failure into two", () => {
    // A reporter that throws inside an error boundary is where a loop starts.
    expect(reporter).toContain("catch");
    expect(reporter).toContain(".catch(() => {");
  });
});
