import { describe, expect, it } from "vitest";
import {
  FORMATS,
  allowedSymbols,
  checkTrade,
  formatById,
  isFormatId,
  positionValue,
} from "@/lib/game/formats";

/*
  The rules of the formats, which are the only thing standing between a battle
  and the ordinary week.

  Two of these matter more than the rest. The short valuation is arithmetic
  that has to agree with the SQL in 0017_battles.sql or a position is worth one
  thing on screen and another when the battle is settled -- and the settled one
  is final. And the universe check is what stops a coin being bought in the
  house week now that the quote layer will happily price one.
*/

const open = formatById("open");
const silicon = formatById("silicon");
const inverse = formatById("inverse");
const oneShot = formatById("one_shot");
const spread = formatById("spread");
const crypto = formatById("crypto");

describe("the catalogue", () => {
  it("has an id, a name and a rule for every format", () => {
    for (const format of FORMATS) {
      expect(format.id).toMatch(/^[a-z_]+$/);
      expect(format.name.length).toBeGreaterThan(0);
      expect(format.rule.length).toBeGreaterThan(0);
      expect(format.benchmark.length).toBeGreaterThan(0);
    }
  });

  it("uses each id once, because a cycle records one and looks it back up", () => {
    const ids = FORMATS.map((format) => format.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("names no company twice inside one list", () => {
    for (const format of FORMATS) {
      const symbols = allowedSymbols(format);
      if (!symbols) continue;
      expect(new Set(symbols).size, format.id).toBe(symbols.length);
    }
  });

  it("falls back to the house game rather than throwing on an unknown id", () => {
    // A cycle recorded with a format this build has dropped still has to
    // render. Showing it as the ordinary week is a far smaller wrong than a
    // screen that will not load.
    expect(formatById("a_format_from_the_future").id).toBe("open");
    expect(formatById(null).id).toBe("open");
    expect(isFormatId("a_format_from_the_future")).toBe(false);
    expect(isFormatId("silicon")).toBe(true);
  });

  it("keeps every list-format's names inside the shape a symbol may take", () => {
    for (const format of FORMATS) {
      for (const symbol of allowedSymbols(format) ?? []) {
        expect(symbol, format.id).toMatch(/^[A-Z0-9.\-]{1,12}$/);
      }
    }
  });
});

describe("what a position is worth", () => {
  it("is shares times price, going long", () => {
    expect(positionValue(open, { quantity: 10, costBasis: 1000, price: 120 })).toBe(1200);
  });

  it("gains what the price loses, going short", () => {
    // Shorted 10 at 100. It falls to 90, so the position is worth 1100.
    expect(positionValue(inverse, { quantity: 10, costBasis: 1000, price: 90 })).toBe(1100);
  });

  it("loses what the price gains, going short", () => {
    expect(positionValue(inverse, { quantity: 10, costBasis: 1000, price: 110 })).toBe(900);
  });

  /*
    The floor is the one place Arena's short is deliberately kinder than a real
    one. A real short has no limit on what it can cost; simulating that with
    pretend money would teach the single lesson about shorting that should not
    be taught with pretend money.
  */
  it("never goes below nothing, however far the price runs", () => {
    expect(positionValue(inverse, { quantity: 10, costBasis: 1000, price: 200 })).toBe(0);
    expect(positionValue(inverse, { quantity: 10, costBasis: 1000, price: 10_000 })).toBe(0);
  });

  it("matches the arithmetic the database settles a short with", () => {
    // 0017_battles.sql writes this as `2 * cost - shares * close`, floored,
    // because that is what survives being one expression inside an aggregate.
    // The two must not drift: the settled number is the final one.
    for (const price of [1, 37.5, 99, 100, 100.01, 250]) {
      const quantity = 12;
      const costBasis = 1200;
      expect(positionValue(inverse, { quantity, costBasis, price })).toBeCloseTo(
        Math.max(2 * costBasis - quantity * price, 0),
        9
      );
    }
  });

  it("shows a position at cost when there is no price, rather than at zero", () => {
    // Zero would look like a wipeout that never happened.
    expect(positionValue(open, { quantity: 10, costBasis: 1000, price: null })).toBe(1000);
    expect(positionValue(inverse, { quantity: 10, costBasis: 1000, price: null })).toBe(1000);
  });
});

describe("what a format lets you buy", () => {
  const base = {
    side: "buy" as const,
    quantity: 1,
    price: 100,
    startingBalance: 100_000,
    positions: [],
  };

  it("lets the house game have shares and funds", () => {
    expect(checkTrade(open, { ...base, symbol: "AAPL", quoteType: "EQUITY" }).ok).toBe(true);
    expect(checkTrade(open, { ...base, symbol: "SPY", quoteType: "ETF" }).ok).toBe(true);
  });

  /*
    The quote layer prices coins now, because the all-hours format asks it to.
    Pricing something is not permission to own it: a market that never shuts
    would make the house week turn on who was awake on Saturday.
  */
  it("keeps coins out of the house game", () => {
    const result = checkTrade(open, {
      ...base,
      symbol: "BTC-USD",
      quoteType: "CRYPTOCURRENCY",
    });
    expect(result.ok).toBe(false);
  });

  it("keeps shares out of the coin game", () => {
    expect(checkTrade(crypto, { ...base, symbol: "AAPL", quoteType: "EQUITY" }).ok).toBe(false);
    expect(checkTrade(crypto, { ...base, symbol: "BTC-USD", quoteType: "CRYPTOCURRENCY" }).ok).toBe(true);
  });

  it("holds a named list to its names", () => {
    expect(checkTrade(silicon, { ...base, symbol: "NVDA", quoteType: "EQUITY" }).ok).toBe(true);
    expect(checkTrade(silicon, { ...base, symbol: "AAPL", quoteType: "EQUITY" }).ok).toBe(false);
  });

  it("says which format refused it and why, rather than just refusing", () => {
    const result = checkTrade(silicon, { ...base, symbol: "AAPL", quoteType: "EQUITY" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("AAPL");
    expect(result.error).toContain(silicon.name);
  });

  /*
    Selling is never refused. A rule that can trap somebody in a position is a
    punishment rather than a game, and a format whose list changed under a
    running battle would do exactly that.
  */
  it("always allows a sale, whatever the rules say about buying it", () => {
    expect(checkTrade(silicon, { ...base, side: "sell", symbol: "AAPL" }).ok).toBe(true);
    expect(checkTrade(crypto, { ...base, side: "sell", symbol: "AAPL" }).ok).toBe(true);
  });
});

describe("how much of one thing", () => {
  const base = {
    side: "buy" as const,
    quantity: 1,
    price: 100,
    startingBalance: 100_000,
    quoteType: "EQUITY",
  };

  it("stops a second company in a one-company format", () => {
    const holding = [{ symbol: "AAPL", quantity: 10, costBasis: 1000 }];
    expect(checkTrade(oneShot, { ...base, symbol: "MSFT", positions: holding }).ok).toBe(false);
    // More of what they already hold is still one company.
    expect(checkTrade(oneShot, { ...base, symbol: "AAPL", positions: holding }).ok).toBe(true);
  });

  it("caps one name at its share of what everybody started with", () => {
    // Spread allows a quarter of 100,000, so 25,000.
    expect(
      checkTrade(spread, { ...base, symbol: "AAPL", quantity: 249, positions: [] }).ok
    ).toBe(true);
    expect(
      checkTrade(spread, { ...base, symbol: "AAPL", quantity: 251, positions: [] }).ok
    ).toBe(false);
  });

  it("counts what is already held towards the cap", () => {
    const positions = [{ symbol: "AAPL", quantity: 200, costBasis: 20_000 }];
    expect(checkTrade(spread, { ...base, symbol: "AAPL", quantity: 60, positions }).ok).toBe(false);
    expect(checkTrade(spread, { ...base, symbol: "AAPL", quantity: 50, positions }).ok).toBe(true);
  });

  it("measures the cap against the starting balance, not against today's value", () => {
    // Otherwise the limit moves as the week goes, and what was allowed on
    // Monday is a rule broken by Thursday without anybody trading.
    const positions = [{ symbol: "AAPL", quantity: 200, costBasis: 20_000 }];
    const generous = checkTrade(spread, {
      ...base,
      symbol: "AAPL",
      quantity: 50,
      positions,
      startingBalance: 100_000,
    });
    expect(generous.ok).toBe(true);
  });
});
