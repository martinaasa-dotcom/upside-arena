import { FREE } from "@/lib/billing/plan";

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

/*
  League limits on the free tier.

  Section 9 of the plan puts "more and larger private leagues" behind the paid
  tier, so these are the numbers that stay free. They are deliberately generous
  enough that nobody hits them by accident: a limit that bites a normal player
  is a bug, not a business model.

  The paid numbers live in src/lib/billing/plan.ts alongside everything else
  money buys, so the whole of what a subscription changes can be read in one
  place and checked in one test. These re-export from there rather than being
  a second copy that can drift.
*/
export { FREE as FREE_LIMITS } from "@/lib/billing/plan";

export const MAX_LEAGUES_OWNED = FREE.leaguesOwned;
export const MAX_LEAGUES_JOINED = FREE.leaguesJoined;
export const MAX_LEAGUE_MEMBERS = FREE.leagueMembers;

/** Icons a league can be given. Kept to a set so a name cannot smuggle markup. */
export const LEAGUE_ICONS = [
  "\u{1F3C6}", "\u{2615}", "\u{1F525}", "\u{1F680}", "\u{1F3AF}", "\u{1F42E}",
  "\u{1F43B}", "\u{1F419}", "\u{1F48E}", "\u{1F340}", "\u{26A1}", "\u{1F9E0}",
] as const;
