import { MARKET_TIMEZONE } from "@/lib/game";

/*
  When it is acceptable to interrupt somebody.

  Kept separate from the code that decides what to say, because these are the
  rules most worth being able to test on their own. A message sent at the wrong
  hour is not a smaller version of a good notification; it is the thing that
  gets the whole channel turned off.
*/

/** Earliest hour, local to the player, that anything may arrive. */
export const AWAKE_FROM = 8;

/** First hour, local to the player, that nothing may arrive. */
export const AWAKE_UNTIL = 21;

/** The window in New York during which a streak reminder makes sense. */
export const STREAK_FROM = 14;
export const STREAK_UNTIL = 20;

/** The hour of the clock in a given place. Falls back to midday if unknown. */
export function hourIn(timezone: string, now: Date): number {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "2-digit",
      hour12: false,
    }).formatToParts(now);

    const value = Number(parts.find((part) => part.type === "hour")?.value);
    if (!Number.isFinite(value)) return 12;

    // Some locales render midnight as 24. Normalising keeps the comparisons
    // below honest at exactly the hour that matters most.
    return value % 24;
  } catch {
    /*
      An unknown timezone must never become the reason somebody is woken up,
      and it must not silence them for ever either. Midday is inside every
      window here, so an unreadable setting behaves as an ordinary afternoon.
    */
    return 12;
  }
}

/** True when the player is likely awake where they are. */
export function isAwakeHour(timezone: string, now: Date = new Date()): boolean {
  const hour = hourIn(timezone, now);
  return hour >= AWAKE_FROM && hour < AWAKE_UNTIL;
}

/**
 * True late enough in the New York day for a streak reminder to be about a
 * deadline rather than about nothing.
 *
 * A streak is credited by opening the app at any hour, so reminding somebody
 * at half past nine in the morning is reminding them of something they have
 * all day to do, which is precisely the manufactured urgency the plan rules
 * out.
 */
export function isStreakReminderHour(now: Date = new Date()): boolean {
  const hour = hourIn(MARKET_TIMEZONE, now);
  return hour >= STREAK_FROM && hour < STREAK_UNTIL;
}
