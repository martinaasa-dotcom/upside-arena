import { afterEach, describe, expect, it, vi } from "vitest";
import { percentOf } from "@/lib/metrics/ratio";

/*
  A metric that is quietly wrong is worse than one that is missing: it gets
  believed, and then acted on. The arithmetic below is trivial, which is
  exactly why it is worth pinning down, and the admin check is the one thing
  on this page that has a security consequence.
*/

describe("expressing a count as a share", () => {
  it("divides", () => {
    expect(percentOf(1, 4)).toBe(25);
    expect(percentOf(3, 4)).toBe(75);
  });

  it("says nothing rather than zero when there is nothing to divide", () => {
    // Zero percent reads as a verdict on the product. Nothing yet is the
    // truth, and the screen says so in words.
    expect(percentOf(0, 0)).toBeNull();
    expect(percentOf(5, 0)).toBeNull();
  });

  it("refuses a negative total rather than inventing a number", () => {
    expect(percentOf(1, -3)).toBeNull();
  });

  it("reports a whole share as a hundred, not as one", () => {
    expect(percentOf(9, 9)).toBe(100);
  });
});

describe("who may see the numbers", () => {
  afterEach(() => {
    vi.resetModules();
    delete process.env.ARENA_ADMIN_EMAILS;
  });

  async function withAdmins(value: string | undefined) {
    vi.resetModules();
    if (value === undefined) delete process.env.ARENA_ADMIN_EMAILS;
    else process.env.ARENA_ADMIN_EMAILS = value;
    return import("@/lib/env");
  }

  it("lets a listed address through", async () => {
    const { isAdmin } = await withAdmins("owner@example.com");
    expect(isAdmin("owner@example.com")).toBe(true);
  });

  it("ignores case and stray spaces, which a pasted list always has", async () => {
    const { isAdmin } = await withAdmins(" Owner@Example.com , second@example.com ");
    expect(isAdmin("owner@example.com")).toBe(true);
    expect(isAdmin("SECOND@example.com")).toBe(true);
  });

  it("keeps everybody else out", async () => {
    const { isAdmin } = await withAdmins("owner@example.com");
    expect(isAdmin("someone@example.com")).toBe(false);
    expect(isAdmin("owner@example.com.evil.test")).toBe(false);
    expect(isAdmin("")).toBe(false);
    expect(isAdmin(null)).toBe(false);
    expect(isAdmin(undefined)).toBe(false);
  });

  it("lets nobody in when the variable is unset", async () => {
    // An unset variable must never be the thing that opens something.
    const { isAdmin, hasAdmins } = await withAdmins(undefined);
    expect(hasAdmins).toBe(false);
    expect(isAdmin("owner@example.com")).toBe(false);
  });

  it("lets nobody in when the variable is empty or only separators", async () => {
    const { isAdmin } = await withAdmins("  , , ");
    expect(isAdmin("owner@example.com")).toBe(false);
    expect(isAdmin("")).toBe(false);
  });
});
