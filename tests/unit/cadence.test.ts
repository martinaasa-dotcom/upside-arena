import { describe, expect, it } from "vitest";
import {
  CADENCES,
  contestTrading,
  isBuyDay,
  isCadenceId,
  nextBuyDay,
  cadencesFor,
  cadenceFits,
  suggestedCadence,
  cadenceById,
  buyWindowCopy,
} from "@/lib/game/cadence";
import { isOpeningBell, isTradingOpen } from "@/lib/market/session";

/*
  When a contest will take a buy.

  These dates are real calendar days, including the holidays, because a window
  that opened on Labor Day would fill at Friday's close. Mondays that the
  exchange is shut are not Mondays for this purpose.
*/

const at = (iso: string) => new Date(iso);

const yearOfChips = {
  startsOn: "2026-01-05",
  endsOn: "2026-12-31",
  tradingHours: "market" as const,
  cadence: "monthly" as const,
  drafted: false,
  finished: false,
};

describe("the catalogue", () => {
  it("uses each id once and finds each one back", () => {
    const ids = CADENCES.map((cadence) => cadence.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const cadence of CADENCES) expect(cadenceById(cadence.id)).toBe(cadence);
  });

  it("falls back to the open book on an id it does not know", () => {
    expect(cadenceById("whenever").id).toBe("always");
    expect(cadenceById(null).id).toBe("always");
    expect(isCadenceId("whenever")).toBe(false);
    expect(isCadenceId("monthly")).toBe(true);
  });

  it("does not offer a monthly window on a one-day battle", () => {
    expect(cadencesFor("day")).not.toContain("monthly");
    expect(cadencesFor("day")).not.toContain("once");
    expect(cadencesFor("year")).toContain("monthly");
    expect(suggestedCadence("year")).toBe("monthly");
    expect(suggestedCadence("week")).toBe("always");
  });
});

describe("which days are a buying day", () => {
  it("opens monthly on the first session of the month, not on the first calendar day", () => {
    // 1 January 2026 is a Thursday and a holiday. The first session is the 2nd.
    expect(isBuyDay("monthly", "2026-01-01", "2026-01-02", "market")).toBe(false);
    expect(isBuyDay("monthly", "2026-01-02", "2026-01-02", "market")).toBe(true);
    expect(isBuyDay("monthly", "2026-01-05", "2026-01-02", "market")).toBe(false);
  });

  it("skips a Monday the exchange is shut", () => {
    // Labor Day 2026 is Monday 7 September.
    expect(isBuyDay("mondays", "2026-09-07", "2026-09-01", "market")).toBe(false);
    expect(isBuyDay("mondays", "2026-09-14", "2026-09-01", "market")).toBe(true);
  });

  it("lets coins buy on a holiday Monday, because their market does not shut", () => {
    expect(isBuyDay("mondays", "2026-09-07", "2026-09-01", "always")).toBe(true);
  });

  it("opens quarterly on the first session of January, April, July and October", () => {
    expect(isBuyDay("quarterly", "2026-04-01", "2026-01-05", "market")).toBe(true);
    expect(isBuyDay("quarterly", "2026-04-02", "2026-01-05", "market")).toBe(false);
    expect(isBuyDay("quarterly", "2026-05-01", "2026-01-05", "market")).toBe(false);
  });

  it("opens once on the contest's first session only", () => {
    expect(isBuyDay("once", "2026-03-02", "2026-03-02", "market")).toBe(true);
    expect(isBuyDay("once", "2026-03-03", "2026-03-02", "market")).toBe(false);
  });
});

describe("whether a buy is taken right now", () => {
  it("takes a sale on a Tuesday in a monthly contest, and refuses a buy", () => {
    // 10:00 in New York on a Wednesday in August. Not the first session of the month.
    const now = at("2026-08-19T14:00:00Z");
    const trading = contestTrading({ ...yearOfChips, cadence: "monthly" }, now);
    expect(trading.selling).toBe(true);
    expect(trading.buying).toBe(false);
    expect(trading.buyReason).toContain("You can still sell");
    expect(trading.nextBuyDay).toBe("2026-09-01");
  });

  it("takes a buy on the first session of the month while the market is open", () => {
    // 1 September 2026 is a Tuesday. 14:00 UTC is 10:00 in New York.
    const now = at("2026-09-01T14:00:00Z");
    const trading = contestTrading({ ...yearOfChips, cadence: "monthly" }, now);
    expect(trading.selling).toBe(true);
    expect(trading.buying).toBe(true);
    expect(trading.buyReason).toBe("");
  });

  it("does not take a buy after the close on a window day", () => {
    const now = at("2026-09-01T20:30:00Z");
    const trading = contestTrading({ ...yearOfChips, cadence: "monthly" }, now);
    expect(trading.selling).toBe(false);
    expect(trading.buying).toBe(false);
    expect(nextBuyDay({ ...yearOfChips, cadence: "monthly" }, now)).toBe("2026-10-01");
    expect(trading.reason).toContain("Next buying morning is 1 Oct");
  });

  it("takes a buy only in the first half hour when the cadence is the bell", () => {
    const contest = { ...yearOfChips, cadence: "bell" as const };
    // 09:45 in New York.
    expect(contestTrading(contest, at("2026-08-19T13:45:00Z")).buying).toBe(true);
    // 10:00 in New York, the window has closed and the session has not.
    expect(isTradingOpen(at("2026-08-19T14:00:00Z"))).toBe(true);
    expect(isOpeningBell(at("2026-08-19T14:00:00Z"))).toBe(false);
    expect(contestTrading(contest, at("2026-08-19T14:00:00Z")).buying).toBe(false);
    expect(contestTrading(contest, at("2026-08-19T14:00:00Z")).selling).toBe(true);
  });

  it("never takes a trade in a drafted contest, even on a window day", () => {
    const now = at("2026-09-01T14:00:00Z");
    const trading = contestTrading(
      { ...yearOfChips, cadence: "monthly", drafted: true },
      now
    );
    expect(trading.selling).toBe(false);
    expect(trading.buying).toBe(false);
    expect(trading.reason).toContain("drafted");
  });

  it("names the first session, once it has passed, as gone rather than as next month", () => {
    const now = at("2026-08-19T14:00:00Z");
    const trading = contestTrading(
      { ...yearOfChips, cadence: "once", startsOn: "2026-01-05" },
      now
    );
    expect(trading.buying).toBe(false);
    expect(trading.selling).toBe(true);
    expect(trading.buyReason).toContain("first session");
    expect(trading.nextBuyDay).toBeNull();
  });

  it("names the actual start day rather than calling every wait a Monday", () => {
    // A Thursday start, the ordinary case for a one-day battle made midweek.
    const now = at("2026-08-19T14:00:00Z");
    const trading = contestTrading(
      { ...yearOfChips, startsOn: "2026-08-27" },
      now
    );
    expect(trading.reason).toContain("27 Aug");
    expect(trading.reason).not.toContain("Monday");
  });

  it("says tomorrow when the next window is the next calendar day", () => {
    // Sunday evening in New York. Next Monday is tomorrow.
    const now = at("2026-08-16T22:00:00Z");
    const trading = contestTrading(
      {
        ...yearOfChips,
        cadence: "mondays",
        startsOn: "2026-08-10",
        endsOn: "2026-09-04",
      },
      now
    );
    expect(trading.buying).toBe(false);
    expect(trading.reason).toContain("Next buying morning is tomorrow");
  });

  it("says tomorrow for the bell after 10:00", () => {
    const contest = { ...yearOfChips, cadence: "bell" as const, endsOn: "2026-08-28" };
    const trading = contestTrading(contest, at("2026-08-19T14:00:00Z"));
    expect(trading.buying).toBe(false);
    expect(trading.selling).toBe(true);
    expect(trading.buyReason).toContain("Next window is tomorrow");
  });
});

describe("the line on the card", () => {
  it("is silent for the open book", () => {
    expect(
      buyWindowCopy({ ...yearOfChips, cadence: "always" }, at("2026-08-19T14:00:00Z"))
    ).toBeNull();
  });

  it("dates the next morning on a monthly year", () => {
    expect(buyWindowCopy({ ...yearOfChips, cadence: "monthly" }, at("2026-08-19T14:00:00Z"))).toMatch(
      /^Buying opens on 1 Sep/
    );
  });

  it("says buying is open while the window is happening", () => {
    expect(buyWindowCopy({ ...yearOfChips, cadence: "monthly" }, at("2026-09-01T14:00:00Z"))).toBe(
      "Buying is open today."
    );
  });

  it("refuses a monthly window on a one-day battle", () => {
    expect(cadenceFits("day", "monthly")).toBe(false);
    expect(cadenceFits("year", "monthly")).toBe(true);
  });
});
