import { describe, expect, it } from "vitest";
import {
  COINS,
  HOUSEHOLD_COINS,
  coinFromSymbol,
  coinSuggestions,
  displaySymbol,
  holdingUnit,
  isCoinPair,
  isCoinSymbol,
  matchCoinQuery,
  searchWantsCoins,
} from "@/lib/coins";

describe("the household catalog", () => {
  it("offers Bitcoin, Ethereum, and Solana on the chips", () => {
    expect(HOUSEHOLD_COINS.map((c) => c.name)).toEqual([
      "Bitcoin",
      "Ethereum",
      "Solana",
    ]);
  });

  it("does not put stables or dust-priced coins on the list", () => {
    const names = COINS.map((c) => c.symbol);
    expect(names).not.toContain("USDT-USD");
    expect(names).not.toContain("USDC-USD");
    expect(names).not.toContain("SHIB-USD");
    expect(names).not.toContain("PEPE-USD");
  });

  it("keeps every stored pair inside the shape a holding may take", () => {
    for (const c of COINS) {
      expect(c.symbol).toMatch(/^[A-Z0-9.\-]{1,12}$/);
    }
  });
});

describe("matchCoinQuery", () => {
  it("maps the names people type to the Yahoo pair we store", () => {
    expect(matchCoinQuery("Bitcoin")?.symbol).toBe("BTC-USD");
    expect(matchCoinQuery("btc")?.symbol).toBe("BTC-USD");
    expect(matchCoinQuery("BTC-USD")?.symbol).toBe("BTC-USD");
    expect(matchCoinQuery("ethereum")?.symbol).toBe("ETH-USD");
    expect(matchCoinQuery("sol")?.symbol).toBe("SOL-USD");
    expect(matchCoinQuery("dogecoin")?.symbol).toBe("DOGE-USD");
    expect(matchCoinQuery("xbt")?.symbol).toBe("BTC-USD");
  });

  it("does not treat NVDA as a coin", () => {
    expect(matchCoinQuery("NVDA")).toBeNull();
    expect(isCoinSymbol("NVDA")).toBe(false);
  });
});

describe("how a coin is written down", () => {
  it("shows BTC, never BTC-USD", () => {
    expect(displaySymbol("BTC-USD")).toBe("BTC");
    expect(displaySymbol("MATIC-USD")).toBe("MATIC");
    expect(displaySymbol("AAPL")).toBe("AAPL");
    expect(coinFromSymbol("BTC-USD")?.name).toBe("Bitcoin");
  });

  it("calls a coin a coin on the holdings row", () => {
    expect(holdingUnit("BTC-USD", 1)).toBe("coin");
    expect(holdingUnit("BTC-USD", 2)).toBe("coins");
    expect(holdingUnit("AAPL", 1)).toBe("share");
    expect(holdingUnit("AAPL", 10)).toBe("shares");
  });

  it("treats any Yahoo pair as a coin for splits and grammar, not just the catalog", () => {
    expect(isCoinPair("MATIC-USD")).toBe(true);
    expect(isCoinPair("BTC-USD")).toBe(true);
    expect(isCoinPair("AAPL")).toBe(false);
    expect(isCoinSymbol("MATIC-USD")).toBe(false);
  });
});

describe("search", () => {
  it("prefix-matches Dogecoin only when they type it", () => {
    expect(coinSuggestions("doge").map((r) => r.symbol)).toContain("DOGE-USD");
    expect(HOUSEHOLD_COINS.some((c) => c.symbol === "DOGE-USD")).toBe(false);
  });

  it("offers coins in the ordinary market and not in funds-only", () => {
    expect(searchWantsCoins(["EQUITY", "ETF"])).toBe(true);
    expect(searchWantsCoins(["CRYPTOCURRENCY"])).toBe(true);
    expect(searchWantsCoins(["ETF", "MUTUALFUND"])).toBe(false);
  });
});
