import { formatDay } from "@/lib/format";
import {
  addDays,
  hasOpenedToday,
  isOpeningBell,
  isTradingDay,
  isTradingOpen,
  nextSessionOnOrAfter,
  nyDate,
} from "@/lib/market/session";
import type { TradingHours } from "@/lib/game/formats";
import type { LengthId } from "@/lib/game/lengths";

/*
  When a contest will take a buy.

  Selling is never gated here. A window that trapped somebody in a name they
  no longer wanted would turn a long battle into a punishment, and the rest of
  Arena already refuses to do that: checkTrade lets every sale through, and so
  does this. What a cadence answers is the other half, the one that actually
  makes a year interactive rather than a longer version of a lock-in: on which
  days may you change your mind by buying something else.

  The week is still the heartbeat. A cadence is an option the league turns on,
  not a new kind of contest. Default is the open book, so a battle started
  without one is the battle Arena has always been.

  Pure, and free of any database. The caller supplies the clock. A format
  whose market never shuts still uses New York calendar days for the windows,
  so "the first session of the month" is the same morning for coins and for
  shares; coins simply keep trading after 16:00 on that day.
*/

export type CadenceId =
  | "always"
  | "mondays"
  | "monthly"
  | "quarterly"
  | "once"
  | "bell";

export type Cadence = {
  id: CadenceId;
  name: string;
  short: string;
  tagline: string;
  rule: string;
};

export const CADENCES: readonly Cadence[] = [
  {
    id: "always",
    name: "Any day",
    short: "Any day",
    tagline: "The open book. Buy whenever this contest's market is open.",
    rule: "Buy and sell whenever this contest's market is open.",
  },
  {
    id: "mondays",
    name: "Mondays",
    short: "Mondays",
    tagline: "One morning a week to change the book.",
    rule: "You may buy on Mondays only. You may sell any day the contest is running.",
  },
  {
    id: "monthly",
    name: "Monthly",
    short: "Monthly",
    tagline: "The first session of each month. Twelve chances in a year.",
    rule: "You may buy on the first session of each month. You may sell any day the contest is running.",
  },
  {
    id: "quarterly",
    name: "Quarterly",
    short: "Quarterly",
    tagline: "Four mornings a year. The rest is living with it.",
    rule: "You may buy on the first session of January, April, July and October. You may sell any day the contest is running.",
  },
  {
    id: "once",
    name: "Opening day",
    short: "Once",
    tagline: "Buy on the first session, then live with it. You may still sell.",
    rule: "You may buy on the first session of this battle only. You may sell any day the contest is running.",
  },
  {
    id: "bell",
    name: "First half hour",
    short: "09:30",
    tagline: "From the open until 10:00. Miss it and you wait until tomorrow.",
    rule: "You may buy in the first half hour after the open. You may sell any day the contest is running.",
  },
];

export const CADENCE_IDS = CADENCES.map((cadence) => cadence.id);

export const DEFAULT_CADENCE: CadenceId = "always";

export function isCadenceId(value: string): value is CadenceId {
  return (CADENCE_IDS as string[]).includes(value);
}

export function cadenceById(id: string | null | undefined): Cadence {
  return CADENCES.find((cadence) => cadence.id === id) ?? CADENCES[0];
}

/**
 * Which cadences are worth offering for a length.
 *
 * Monthly on a one-day battle is a window that probably never opens. Opening
 * day on a one-day battle is the open book under another name. The form hides
 * those, and startBattle refuses them, so a crafted request cannot store a
 * combination the room then has to apologise for.
 */
export function cadencesFor(length: LengthId): CadenceId[] {
  switch (length) {
    case "day":
      return ["always", "bell"];
    case "week":
    case "fortnight":
      return ["always", "mondays", "bell", "once"];
    case "month":
      return ["always", "mondays", "monthly", "bell", "once"];
    default:
      return [...CADENCE_IDS];
  }
}

export function cadenceFits(length: LengthId, cadence: CadenceId): boolean {
  return cadencesFor(length).includes(cadence);
}

/** What to pick when the length changes and the current cadence no longer fits. */
export function suggestedCadence(length: LengthId): CadenceId {
  if (length === "quarter" || length === "year") return "monthly";
  if (length === "month") return "mondays";
  return "always";
}

export type ContestClock = {
  startsOn: string;
  endsOn: string;
  tradingHours: TradingHours;
  cadence: CadenceId;
  drafted: boolean;
  finished: boolean;
};

export type ContestTrading = {
  selling: boolean;
  buying: boolean;
  /** Why selling is shut. Empty while it is open. */
  reason: string;
  /** Why buying is shut. Empty while it is open. */
  buyReason: string;
  /** The next calendar day a buy will be taken, including today when it will. */
  nextBuyDay: string | null;
};

function alwaysOpen(hours: TradingHours) {
  return hours === "always";
}

function weekdayMonday1(iso: string) {
  const day = new Date(`${iso}T12:00:00Z`).getUTCDay();
  return day === 0 ? 7 : day;
}

function monthStart(iso: string) {
  return `${iso.slice(0, 8)}01`;
}

function firstSessionOfMonth(iso: string) {
  return nextSessionOnOrAfter(monthStart(iso));
}

function firstSessionOfQuarter(iso: string) {
  const month = Number(iso.slice(5, 7));
  const year = iso.slice(0, 4);
  const quarterStartMonth = month <= 3 ? "01" : month <= 6 ? "04" : month <= 9 ? "07" : "10";
  return nextSessionOnOrAfter(`${year}-${quarterStartMonth}-01`);
}

function firstBuyDay(startsOn: string, hours: TradingHours) {
  return alwaysOpen(hours) ? startsOn : nextSessionOnOrAfter(startsOn);
}

/** Whether this New York calendar date is a day on which a buy may be taken. */
export function isBuyDay(
  cadence: CadenceId,
  date: string,
  startsOn: string,
  hours: TradingHours
): boolean {
  switch (cadence) {
    case "always":
      return alwaysOpen(hours) || isTradingDay(date);
    case "mondays":
      if (weekdayMonday1(date) !== 1) return false;
      return alwaysOpen(hours) || isTradingDay(date);
    case "monthly":
      return date === firstSessionOfMonth(date);
    case "quarterly":
      return date === firstSessionOfQuarter(date);
    case "once":
      return date === firstBuyDay(startsOn, hours);
    case "bell":
      return isTradingDay(date);
  }
}

function buyOpenNow(input: ContestClock, now: Date): boolean {
  const today = nyDate(now);
  if (!isBuyDay(input.cadence, today, input.startsOn, input.tradingHours)) {
    return false;
  }
  if (input.cadence === "bell") return isOpeningBell(now);
  if (alwaysOpen(input.tradingHours)) return true;
  return isTradingOpen(now);
}

/**
 * Whether today's window is still ahead of us, so a countdown should name
 * today rather than skip to the next one.
 */
function todayStillComing(input: ContestClock, now: Date): boolean {
  const today = nyDate(now);
  if (!isBuyDay(input.cadence, today, input.startsOn, input.tradingHours)) {
    return false;
  }
  if (buyOpenNow(input, now)) return true;
  if (alwaysOpen(input.tradingHours)) return false;
  if (!isTradingDay(today)) return false;
  if (input.cadence === "bell") return !hasOpenedToday(now) || isOpeningBell(now);
  return !hasOpenedToday(now);
}

export function nextBuyDay(input: ContestClock, now = new Date()): string | null {
  const today = nyDate(now);
  let date = today < input.startsOn ? input.startsOn : today;

  for (let step = 0; step < 400; step++) {
    if (date > input.endsOn) return null;
    if (isBuyDay(input.cadence, date, input.startsOn, input.tradingHours)) {
      if (date > today) return date;
      if (todayStillComing(input, now)) return date;
    }
    date = addDays(date, 1);
  }

  return null;
}

/**
 * A calendar day, said the way a person would: today, tomorrow, or the date.
 *
 * The dated form is what a year-long monthly contest needs. The relative
 * form is what a Monday window needs on Sunday evening, and what the bell
 * needs at 10:01.
 */
function sayDay(iso: string, today: string): string {
  if (iso === today) return "today";
  if (iso === addDays(today, 1)) return "tomorrow";
  return formatDay(iso);
}

function buyingOpensPhrase(iso: string, today: string): string {
  const when = sayDay(iso, today);
  if (when === "today" || when === "tomorrow") return `Buying opens ${when}.`;
  return `Buying opens on ${when}.`;
}

function buyingShutReason(cadence: Cadence, next: string | null, today: string): string {
  if (cadence.id === "once" && next == null) {
    return "Buying was only allowed on the first session of this battle. You can still sell.";
  }
  if (next == null) {
    return "There is no buying day left in this battle. You can still sell.";
  }
  if (cadence.id === "bell") {
    return `Buying is only allowed in the first half hour after the open. Next window is ${sayDay(next, today)}. You can still sell.`;
  }
  return `${buyingOpensPhrase(next, today)} You can still sell.`;
}

function startsReason(startsOn: string, today: string): string {
  const when = sayDay(startsOn, today);
  if (when === "today" || when === "tomorrow") {
    return `This battle starts ${when}. Nothing you do before then counts.`;
  }
  return `This battle starts on ${when}. Nothing you do before then counts.`;
}

/**
 * The next buying morning, for a card rather than for the trade form.
 *
 * Dated, and silent when the cadence is the open book, because repeating
 * "buy whenever the market is open" on every BattleCard is a rule nobody
 * came here to be told. Empty before the contest starts: the badge already
 * names that day.
 */
export function buyWindowCopy(input: ContestClock, now = new Date()): string | null {
  if (input.cadence === "always") return null;
  if (input.finished || input.drafted) return null;

  const today = nyDate(now);
  if (today < input.startsOn) return null;

  const trading = contestTrading(input, now);
  if (trading.buying) {
    return input.cadence === "bell" ? "Buying is open until 10:00." : "Buying is open today.";
  }
  if (trading.nextBuyDay) {
    if (input.cadence === "bell") {
      return `Buying is only allowed until 10:00. Next window is ${sayDay(trading.nextBuyDay, today)}.`;
    }
    return buyingOpensPhrase(trading.nextBuyDay, today);
  }
  if (input.cadence === "once") {
    return "Buying was only allowed on the first session.";
  }
  return "There is no buying day left.";
}

/**
 * Whether this contest will take a sale or a buy right now, and why not.
 *
 * Drafted contests still take neither. A cadence does not reopen a board
 * somebody drafted: that is a different game, and it is not this one.
 */
export function contestTrading(input: ContestClock, now = new Date()): ContestTrading {
  const cadence = cadenceById(input.cadence);
  const empty = {
    selling: false,
    buying: false,
    nextBuyDay: null as string | null,
  };

  if (input.finished) {
    return {
      ...empty,
      reason: "This battle is over. The result is above.",
      buyReason: "This battle is over. The result is above.",
    };
  }

  const today = nyDate(now);

  if (today < input.startsOn) {
    const reason = startsReason(input.startsOn, today);
    return { ...empty, reason, buyReason: reason };
  }

  if (input.drafted) {
    const reason =
      "You hold what you drafted. Nothing here is bought or sold until it settles.";
    return { ...empty, reason, buyReason: reason };
  }

  if (today > input.endsOn) {
    const reason = "This battle has finished. The result lands once it is scored.";
    return { ...empty, reason, buyReason: reason };
  }

  const marketOpen = alwaysOpen(input.tradingHours) || isTradingOpen(now);
  const next = nextBuyDay(input, now);

  if (!marketOpen) {
    const hours =
      "The market is closed. Trading runs from 09:30 to 16:00 New York time, weekdays.";
    const window =
      cadence.id === "always" || !next
        ? ""
        : ` Next buying morning is ${sayDay(next, today)}.`;
    const reason = hours + window;
    return {
      selling: false,
      buying: false,
      reason,
      buyReason: reason,
      nextBuyDay: next,
    };
  }

  const buying = buyOpenNow(input, now);

  return {
    selling: true,
    buying,
    reason: "",
    buyReason: buying ? "" : buyingShutReason(cadence, next, today),
    nextBuyDay: next,
  };
}
