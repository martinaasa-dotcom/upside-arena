import { describe, expect, it } from "vitest";
import {
  formatGap,
  formatMoney,
  formatPercent,
  formatTime,
  initials,
  plural,
} from "@/lib/format";

describe("formatTime", () => {
  it("uses a 24-hour clock", () => {
    // 20:30 UTC must never render as "8:30 PM".
    expect(formatTime("2026-08-21T20:30:00Z")).toBe("20:30");
    expect(formatTime("2026-08-21T08:05:00Z")).toBe("08:05");
    expect(formatTime("2026-08-21T00:00:00Z")).toBe("00:00");
  });
});

describe("formatPercent", () => {
  it("signs a gain and leaves a loss with its own minus", () => {
    expect(formatPercent(3.84)).toBe("+3.8%");
    expect(formatPercent(-0.62)).toBe("-0.6%");
    expect(formatPercent(0)).toBe("0.0%");
  });
});

describe("formatMoney", () => {
  it("renders whole play dollars", () => {
    expect(formatMoney(10000)).toBe("$10,000");
  });
});

describe("initials", () => {
  it("takes at most two", () => {
    expect(initials("Sarah Chen")).toBe("SC");
    expect(initials("Marcus")).toBe("M");
    expect(initials("ada b cooper")).toBe("AB");
  });

  it("copes with nothing", () => {
    expect(initials(null)).toBe("?");
    expect(initials("")).toBe("?");
    expect(initials("   ")).toBe("?");
  });
});

describe("formatGap", () => {
  it("drops the sign, because the sentence already carries the direction", () => {
    // "+1.7% behind Bo" reads wrong, and "-1.7% behind Bo" reads worse.
    expect(formatGap(1.7)).toBe("1.7%");
    expect(formatGap(-1.7)).toBe("1.7%");
    expect(formatGap(0)).toBe("0.0%");
  });
});

describe("plural", () => {
  it("does not say one days", () => {
    expect(plural(1, "day")).toBe("1 day");
    expect(plural(2, "day")).toBe("2 days");
    expect(plural(0, "day")).toBe("0 days");
    expect(plural(1, "freeze")).toBe("1 freeze");
    expect(plural(3, "freeze")).toBe("3 freezes");
  });
});
