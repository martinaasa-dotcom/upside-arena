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

export function formatTime(value: Date | string) {
  return TIME.format(typeof value === "string" ? new Date(value) : value);
}

export function formatDate(value: Date | string) {
  return DATE.format(typeof value === "string" ? new Date(value) : value);
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
