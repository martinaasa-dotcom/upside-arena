import { describe, expect, it } from "vitest";
import { safeNext } from "@/lib/redirects";

describe("safeNext", () => {
  it("keeps a same-origin path", () => {
    expect(safeNext("/profile")).toBe("/profile");
    expect(safeNext("/leagues/abc?tab=standings")).toBe("/leagues/abc?tab=standings");
  });

  it("falls back when nothing is given", () => {
    expect(safeNext(undefined)).toBe("/home");
    expect(safeNext(null)).toBe("/home");
    expect(safeNext("")).toBe("/home");
  });

  it("refuses to send a signed-in player off site", () => {
    // A protocol-relative URL is the open-redirect case that matters.
    expect(safeNext("//evil.example/steal")).toBe("/home");
    expect(safeNext("https://evil.example")).toBe("/home");
    expect(safeNext("http://evil.example")).toBe("/home");
    expect(safeNext("/\\evil.example")).toBe("/home");
    expect(safeNext("javascript:alert(1)")).toBe("/home");
  });

  it("honours a caller supplied fallback", () => {
    expect(safeNext("https://evil.example", "/")).toBe("/");
  });
});
