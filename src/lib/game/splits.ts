import "server-only";

import { isCoinPair } from "@/lib/coins";
import { canWriteGame } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getSplits,
  isRealSplitRatio,
  type SplitEvent,
} from "@/lib/market/benchmark";
import { getQuotes } from "@/lib/market/quotes";
import { addDays, hasOpenedToday, nyDate } from "@/lib/market/session";

/*
  Share splits, which are the one thing that changes a position without
  anybody trading it.

  Nvidia split ten for one on 10 June 2024. A hundred shares became a
  thousand, each worth a tenth of what it had been, and nothing was bought or
  sold. Every price Arena can read is post-split from that morning on, because
  the old one cannot be traded again, so a game that keeps holding a hundred
  values the position at a tenth of the truth and shows somebody who did
  nothing a ninety per cent loss. A reverse split does it the other way and is
  worse, because it looks like winning: one for ten leaves the shares at ten
  times the price and prints a nine hundred per cent week nobody earned.

  The work itself is in the database, in one transaction per company, because
  it moves shares and cash together and neither may happen without the other.
  What is here is the part the database cannot do: knowing that a split
  happened at all.

  Timing is the whole design, and it is later than it first looks. The check
  runs on the first pass after the opening bell, not before it, because a
  fraction of a share is paid out in cash at the price of a share and before
  the bell the only price there is is yesterday's, which is the pre-split one:
  paying a tenth of a share at ten times what it is worth is a worse bug than
  the one being fixed. After the bell the price is the new one and everything
  agrees.

  That leaves minutes rather than a day of a screen showing the wrong share
  count, and it leaves them at the quietest end of the morning. Applied at the
  close instead, it would be right by settlement and wrong on every screen all
  day, with the standings and the notifications built on top of it.
*/

/**
 * How far back a check looks.
 *
 * Four days, so a long weekend or a quiet Tuesday when nothing ran does not
 * lose a split. Applying one late is safe: the ledger refuses a repeat, and
 * apply_split leaves alone any portfolio that has traded the company since,
 * because those shares were bought at the new price and already counted the
 * new way.
 */
const LOOKBACK_DAYS = 4;

export type AppliedSplit = SplitEvent & {
  price: number;
  adjusted: number;
  skipped: number;
};

export type SplitCheck = {
  day: string;
  status: "done" | "claimed-elsewhere" | "early" | "no-answer" | "off";
  symbols?: number;
  applied?: AppliedSplit[];
};

/*
  The guard against a spinoff adjustment factor lives in `benchmark.ts`,
  at the fetch, so nothing downstream of `getSplits` ever sees one. It is
  re-exported here because this module guards the same thing again at the
  window it applies from, and two copies of the rule with two copies of
  the ceiling is how the two come to disagree.
*/
export { isRealSplitRatio };

/**
 * Which of a company's splits this check should act on.
 *
 * Pure, so the window can be tested without a market. A split dated in the
 * future has not happened yet and its price is not the one to pay a fraction
 * of a share at.
 */
export function splitsInWindow(
  events: readonly SplitEvent[],
  today: string,
  lookbackDays = LOOKBACK_DAYS
): SplitEvent[] {
  const from = addDays(today, -lookbackDays);
  return events.filter(
    (event) =>
      event.effectiveOn >= from &&
      event.effectiveOn <= today &&
      // A spinoff adjustment factor arrives here looking like a split and
      // would move every lineup holding it. See `isRealSplitRatio`.
      isRealSplitRatio(event.numerator, event.denominator)
  );
}

/**
 * Every company held in a week that is still running.
 *
 * Asked as one function rather than as an embedded join, because the join is
 * two levels deep and the failure mode of writing it slightly wrong is an
 * empty list, which looks exactly like a day on which nothing split. A silent
 * nothing is the worst possible answer from a check like this one.
 */
async function heldSymbols(): Promise<string[]> {
  const admin = createAdminClient();
  const { data } = await admin.rpc("symbols_in_open_weeks");

  return [
    ...new Set(
      ((data ?? []) as { symbol: string }[])
        .map((row) => row.symbol)
        .filter((symbol) => !isCoinPair(symbol))
    ),
  ];
}

/**
 * Finds the day's splits and applies them, once per day for the whole app.
 *
 * Safe to call from anywhere and as often as anyone likes. The day's claim
 * means one worker asks the provider, and the ledger means a split is applied
 * once however many workers get past it.
 */
export async function applyDueSplits(now = new Date()): Promise<SplitCheck> {
  const day = nyDate(now);

  if (!canWriteGame) return { day, status: "off" };

  /*
    Before the bell there is no post-split price to pay a fraction of a share
    at, so nothing is done and, deliberately, nothing is claimed either: the
    day's claim is what stops a second worker looking, and taking it here
    would mean the pre-open pass quietly used up the day's one look.
  */
  if (!hasOpenedToday(now)) return { day, status: "early" };

  const admin = createAdminClient();

  const { data: claimed } = await admin.rpc("claim_split_check", { p_day: day });
  if (!claimed) return { day, status: "claimed-elsewhere" };

  const symbols = await heldSymbols();
  if (symbols.length === 0) return { day, status: "done", symbols: 0, applied: [] };

  const from = addDays(day, -LOOKBACK_DAYS);

  /*
    One request per company held, and only for companies somebody holds. A
    split in a company nobody owns changes nothing here, so asking about it
    would be a request spent on nothing.
  */
  const answers = await Promise.all(
    symbols.map((symbol) => getSplits(symbol, from, day))
  );

  /*
    Nobody answered, which is not the same as nobody split.

    The day's claim exists so one worker asks and the rest do not, and if that
    one worker asked into a provider that was down, giving the claim back is
    the difference between a split found an hour later and a split found
    tomorrow, by which time somebody has looked at a portfolio that says they
    are down ninety per cent.
  */
  if (answers.every((answer) => answer === null)) {
    await admin.from("split_checks").delete().eq("day", day);
    return { day, status: "no-answer", symbols: symbols.length };
  }

  const found = answers
    .filter((answer): answer is SplitEvent[] => answer !== null)
    .flatMap((events) => splitsInWindow(events, day));

  if (found.length === 0) {
    return { day, status: "done", symbols: symbols.length, applied: [] };
  }

  /*
    The price a fraction of a share is paid out at, which has to be the
    post-split one. Read here rather than in the database, which has no
    prices, and read after the splits are known so it is one request for the
    handful of companies that actually split rather than for all of them.
  */
  const quotes = await getQuotes(found.map((split) => split.symbol));
  const applied: AppliedSplit[] = [];

  for (const split of found) {
    const price = quotes[split.symbol]?.price;

    // No price, no payout, no adjustment. Tomorrow's check finds it again,
    // and adjusting shares while guessing at the cash would be worse than
    // being a day late.
    if (price == null || !Number.isFinite(price) || price <= 0) continue;

    const { data } = await admin.rpc("apply_split", {
      p_symbol: split.symbol,
      p_effective_on: split.effectiveOn,
      p_numerator: split.numerator,
      p_denominator: split.denominator,
      p_price: price,
    });

    const row = data as { holdings_adjusted?: number; holdings_skipped?: number } | null;

    applied.push({
      ...split,
      price,
      adjusted: row?.holdings_adjusted ?? 0,
      skipped: row?.holdings_skipped ?? 0,
    });
  }

  return { day, status: "done", symbols: symbols.length, applied };
}
