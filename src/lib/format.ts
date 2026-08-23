/*
  24-hour clock only. Money and percents use tabular figures, so pair these
  with the .figure class wherever a number is shown.
*/

const TIME = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const DATE = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

/**
 * What a cell says when there is no number to put in it.
 *
 * This used to be an em dash, which is the convention every annual report
 * uses for nil and is also the single loudest tell that a sentence was
 * generated rather than written. A reader never sees one of those in
 * Arena, and a reader sees these: they are the fallback in every Score
 * card on Home, in a battle, and in a record.
 *
 * A bare hyphen was the obvious swap and is wrong. These sit beside signed
 * percentages in `tabular-nums` columns, where a loss already renders with
 * a leading `-`, so a lone `-` two rows down reads as a number whose
 * digits failed to load rather than as "we do not have this". `n/a` cannot
 * be misread as arithmetic, and it is what a person would actually write.
 *
 * One constant, so it is one edit if that call ever changes.
 */
export const NO_VALUE = "n/a";

export function formatTime(value: Date | string) {
  return TIME.format(typeof value === "string" ? new Date(value) : value);
}

export function formatDate(value: Date | string) {
  return DATE.format(typeof value === "string" ? new Date(value) : value);
}

/**
 * How long ago something was, in the coarsest unit that still says it.
 *
 * Rounds down, then floors at one, so a gap this is asked about never reads
 * as "0m". Anything worth putting an age on has already lasted longer than
 * the last quote's sixty seconds, and "0m ago" is a sentence that describes
 * now while claiming to describe the past.
 */
export function formatAge(ms: number) {
  const minutes = Math.floor(Math.max(0, ms) / 60_000);
  if (minutes < 60) return `${Math.max(1, minutes)}m`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;

  return `${Math.floor(hours / 24)}d`;
}

/**
 * How far behind the prices on a screen are.
 *
 * Here rather than beside the component that draws it, because the component
 * is a client one and the gallery is a server one, and both need the exact
 * sentence: the gallery measures the widest reading it has at every width a
 * phone reports, and a second copy of the words is a second thing to forget.
 */
export function priceAgeLabel(ms: number) {
  return `Prices from ${formatAge(ms)} ago`;
}

/**
 * Money, whole by default.
 *
 * A portfolio worth $104,382.17 is worth $104,382, and the cents are noise in
 * a column somebody is scanning. A fill price is the opposite: $765.72 is not
 * $766, and rounding the number somebody was actually filled at is the kind of
 * small lie a scoreboard cannot afford. So the digits are a parameter, and
 * both callers say which they mean.
 */
export function formatMoney(value: number, currency = "USD", digits = 0) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

export function formatPercent(value: number, digits = 1) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(digits)}%`;
}

/**
 * A gap between two numbers, for a sentence that already says which way it
 * goes. "1.7% behind Bo" reads correctly; "+1.7% behind Bo" does not, and
 * "-1.7% behind Bo" is worse.
 */
export function formatGap(value: number, digits = 1) {
  return `${Math.abs(value).toFixed(digits)}%`;
}

/** Initials for an avatar fallback. */
export function initials(name: string | null | undefined) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

/** "1 day", "2 days". Written down once so it cannot be got wrong twice. */
/**
 * A place, written the way it is said: 1st, 2nd, 3rd, 11th.
 *
 * The teens are the whole reason this is a function. Eleventh, twelfth and
 * thirteenth all take "th" despite ending in 1, 2 and 3.
 */
export function ordinal(place: number): string {
  const n = Math.abs(Math.trunc(place));
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${place}th`;

  const suffix = { 1: "st", 2: "nd", 3: "rd" }[n % 10] ?? "th";
  return `${place}${suffix}`;
}

export function plural(count: number, one: string, many = `${one}s`) {
  return `${count} ${count === 1 ? one : many}`;
}
