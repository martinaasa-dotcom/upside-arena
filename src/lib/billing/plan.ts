/*
  What money buys, and what it must never buy.

  Section 9 of the plan locks this: money never touches competitive scoring,
  odds, or trading capability. It buys cosmetics and convenience. Everything
  below is one of those two, and the list is written out here rather than
  scattered through the code so that the rule can be read in one place and
  checked in one test.

  Pure, and free of any payment provider, because the same limits apply
  however somebody came to be entitled.
*/

/** The product ids entitlements are keyed by. */
export const PLUS = "plus";

export type Limits = {
  /** How many leagues one person may run. */
  leaguesOwned: number;
  /** How many they may be in. */
  leaguesJoined: number;
  /** How many people fit in one. */
  leagueMembers: number;
  /** Freezes granted at the start of each week. */
  weeklyFreezes: number;
  /** Whether the deeper personal stats are shown. */
  deeperStats: boolean;
};

/*
  The free tier is the whole game: portfolios, leagues, streaks, standings, no
  ads. These numbers are deliberately generous enough that nobody hits them by
  accident. A limit that bites an ordinary player is a bug, not a business
  model.
*/
export const FREE: Limits = {
  leaguesOwned: 3,
  leaguesJoined: 10,
  leagueMembers: 20,
  weeklyFreezes: 1,
  deeperStats: false,
};

export const PLUS_LIMITS: Limits = {
  leaguesOwned: 10,
  leaguesJoined: 30,
  leagueMembers: 50,
  weeklyFreezes: 3,
  deeperStats: true,
};

export function limitsFor(hasPlus: boolean): Limits {
  return hasPlus ? PLUS_LIMITS : FREE;
}

/*
  What the subscription page promises, in the order it says it.

  Every line is either a cosmetic or a convenience. If a line ever needs to
  describe an advantage in the game itself, the answer is that the line is
  wrong, not that the rule has moved.
*/
export const PLUS_BENEFITS = [
  {
    title: "Three streak freezes a week instead of one",
    detail:
      "A freeze covers a day you did not open Arena. It has never affected a score, and it still does not.",
  },
  {
    title: "Ten leagues instead of three, and fifty people in each",
    detail: "For anybody running a league for a whole office or class.",
  },
  {
    title: "Your full history",
    detail:
      "Every week you have played, day by day, rather than the last one. Nobody else sees anything new about you.",
  },
  {
    title: "Two titles only members can wear",
    detail: "Decoration. A title has never changed a score and never will.",
  },
] as const;

/*
  Coin bundles.

  Every one is a fixed number of coins for a fixed price. There is no bundle
  whose contents are decided by chance: a randomised paid box is banned
  outright in some countries and is the most criticised pattern in consumer
  software, and section 3 rules it out regardless.
*/
export type CoinBundle = {
  id: string;
  coins: number;
  /** In the smallest currency unit, so no float ever touches a price. */
  amount: number;
  currency: string;
  label: string;
};

export const COIN_BUNDLES: CoinBundle[] = [
  { id: "coins_500", coins: 500, amount: 199, currency: "eur", label: "500 coins" },
  { id: "coins_1200", coins: 1200, amount: 399, currency: "eur", label: "1,200 coins" },
  { id: "coins_3000", coins: 3000, amount: 899, currency: "eur", label: "3,000 coins" },
];

export function bundle(id: string): CoinBundle | null {
  return COIN_BUNDLES.find((entry) => entry.id === id) ?? null;
}

/** A price in whole currency, for showing. */
export function formatPrice(amount: number, currency: string) {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amount / 100);
}

/*
  What a coin is, said plainly and in one place, because several screens and
  the terms all have to agree.
*/
export const COIN_TERMS =
  "Coins are not money. They cannot be exchanged for money, moved to another account, or refunded once spent, and they buy nothing that affects your score.";
