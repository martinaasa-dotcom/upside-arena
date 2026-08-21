/*
  The rules of the game, in one place.

  These are deliberate product decisions, not tunables to reach for. Changing
  the starting balance mid-season would make one week's result mean something
  different from another's, so a portfolio records the balance it started with
  rather than reading this constant back later.
*/

/**
 * What everyone starts each week with.
 *
 * Identical for every player, every week. This is what makes a league a race
 * rather than a function of how long someone has been playing.
 */
export const STARTING_BALANCE = 100_000;

/** What the week is measured against. */
export const BENCHMARK_SYMBOL = "SPY";

/** The market Arena follows, for opening hours and week boundaries. */
export const MARKET_TIMEZONE = "America/New_York";

/** Trading opens Monday and the week is scored at Friday's close. */
export const MARKET_OPEN = { hour: 9, minute: 30 };
export const MARKET_CLOSE = { hour: 16, minute: 0 };

/**
 * How stale a cached quote may be before it is refetched.
 *
 * The data is already delayed by roughly fifteen minutes, so a short cache on
 * top costs accuracy nothing and turns per-user requests into per-symbol ones.
 */
export const QUOTE_TTL_SECONDS = 60;

/** Nobody can hold a fraction of a share. Keeps position sizing legible. */
export const WHOLE_SHARES_ONLY = true;

/**
 * Anti-cheat. A person cannot click this fast, so anything above it is a
 * script trying to game a leaderboard.
 */
export const MAX_TRADES_PER_MINUTE = 10;
export const MAX_TRADES_PER_CYCLE = 500;
