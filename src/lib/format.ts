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

export function formatMoney(value: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
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
export function plural(count: number, one: string, many = `${one}s`) {
  return `${count} ${count === 1 ? one : many}`;
}
