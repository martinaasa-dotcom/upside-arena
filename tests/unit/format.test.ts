import { describe, expect, it } from "vitest";
import {
  formatGap,
  formatMoney,
  formatPercent,
  formatTime,
  initials,
  ordinal,
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
    expect(formatMoney(104_382.17)).toBe("$104,382");
  });

  it("keeps the cents when asked, because a fill price is not a total", () => {
    // A portfolio worth $104,382.17 is worth $104,382 and the cents are noise
    // in a column. Rounding the price somebody was actually filled at is a
    // different thing, and a scoreboard cannot afford that kind of small lie.
    expect(formatMoney(765.72, "USD", 2)).toBe("$765.72");
    expect(formatMoney(766, "USD", 2)).toBe("$766.00");
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

describe("ordinal", () => {
  it("writes a place the way it is said", () => {
    expect(ordinal(1)).toBe("1st");
    expect(ordinal(2)).toBe("2nd");
    expect(ordinal(3)).toBe("3rd");
    expect(ordinal(4)).toBe("4th");
  });

  it("gets the teens right", () => {
    // The whole reason this is a function rather than a lookup on the last
    // digit. Eleventh is not "11st".
    expect(ordinal(11)).toBe("11th");
    expect(ordinal(12)).toBe("12th");
    expect(ordinal(13)).toBe("13th");
  });

  it("carries on past the teens", () => {
    expect(ordinal(21)).toBe("21st");
    expect(ordinal(22)).toBe("22nd");
    expect(ordinal(23)).toBe("23rd");
    expect(ordinal(101)).toBe("101st");
    expect(ordinal(111)).toBe("111th");
    expect(ordinal(112)).toBe("112th");
  });
});
