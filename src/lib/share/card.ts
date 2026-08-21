import { formatGap, formatPercent, plural } from "@/lib/format";

/*
  What a shared week actually says.

  Pure, and separate from the database and the image, because this is the
  thing that either gets posted or does not. Section 2.6 calls the share loop
  the real growth engine, and the whole of it rests on one requirement: the
  card has to be worth posting after a bad week too. Nobody shares something
  that makes them look foolish, so nothing here scolds, and nothing here
  congratulates so hard that the losing version reads as consolation.

  The Wordle lesson is not the emoji. It is that the grid showed the shape of
  an attempt in a form you could paste anywhere, which meant it travelled
  through plain text into places no image ever reaches. The row of blocks
  below does that job: five characters, one per trading day, readable in a
  message with no preview and no link expanded.
*/

export type Recap = {
  displayName: string;
  title: string | null;
  monday: string;
  returnPercent: number;
  benchmarkReturn: number | null;
  benchmarkDiff: number | null;
  league: { name: string; rank: number; size: number } | null;
  streakDays: number;
  /** Daily returns in percent, oldest first. Fewer than five is normal. */
  marks: number[];
};

/*
  The blocks, lightest to heaviest. A shared row is only readable if the
  reader can tell the characters apart at message size, so these are the
  eighth-blocks rather than a longer ramp with steps nobody can distinguish.
*/
const BLOCKS = ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"];

/**
 * The week as a row of blocks.
 *
 * Height is relative to the week's own range rather than to some fixed scale,
 * because a week that moved half a percent has a shape too and flattening it
 * to five identical blocks throws away the only interesting thing about it.
 * A genuinely flat week gets a flat row, which is honest.
 */
export function sparkline(marks: number[]): string {
  if (marks.length === 0) return "";

  const low = Math.min(...marks);
  const high = Math.max(...marks);
  const range = high - low;

  // Every day the same. A middle block reads as level; the lowest would read
  // as a bad week that never happened.
  if (range < 0.0001) return BLOCKS[3].repeat(marks.length);

  return marks
    .map((mark) => {
      const position = (mark - low) / range;
      const index = Math.min(BLOCKS.length - 1, Math.floor(position * BLOCKS.length));
      return BLOCKS[index];
    })
    .join("");
}

/** "week of 17 August". Spelled out, because a shared line has no context. */
export function weekLabel(monday: string): string {
  const date = new Date(`${monday}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(date);
}

/**
 * How the week went against the market, in one line.
 *
 * Always the comparison rather than the raw number, because beating a falling
 * market is a good week and the raw number alone calls it a bad one.
 */
export function versusMarketLine(diff: number | null): string | null {
  if (diff == null) return null;
  if (Math.abs(diff) < 0.05) return "Level with the market";
  return diff > 0
    ? `${formatGap(diff)} ahead of the market`
    : `${formatGap(diff)} behind the market`;
}

/** "2nd of 6". Plain enough for anyone reading over a shoulder. */
export function ordinal(value: number): string {
  const rest = value % 100;
  if (rest >= 11 && rest <= 13) return `${value}th`;

  switch (value % 10) {
    case 1:
      return `${value}st`;
    case 2:
      return `${value}nd`;
    case 3:
      return `${value}rd`;
    default:
      return `${value}th`;
  }
}

/**
 * The text somebody pastes.
 *
 * Deliberately plain. It has to survive a group chat that strips formatting,
 * an app that never renders the link preview, and a screenshot. Everything
 * that matters is in the words; the image and the link are extras.
 */
export function shareText(recap: Recap, url: string): string {
  const lines: string[] = [`Upside Arena, week of ${weekLabel(recap.monday)}`];

  const shape = sparkline(recap.marks);
  if (shape) lines.push(shape);

  lines.push(formatPercent(recap.returnPercent));

  const versus = versusMarketLine(recap.benchmarkDiff);
  if (versus) lines.push(versus);

  if (recap.league) {
    lines.push(
      `${ordinal(recap.league.rank)} of ${recap.league.size} in ${recap.league.name}`
    );
  }

  if (recap.streakDays > 0) {
    lines.push(`${plural(recap.streakDays, "day")} in a row`);
  }

  lines.push("", url);

  return lines.join("\n");
}

/**
 * The headline on the card itself.
 *
 * Never "you lost". A week is a result, and the card that says so plainly is
 * the one people are willing to post twice.
 */
export function headline(recap: Recap): string {
  if (recap.benchmarkDiff != null && recap.benchmarkDiff >= 0.05) {
    return "Beat the market";
  }
  if (recap.returnPercent >= 0.05) return "Finished up";
  if (recap.returnPercent <= -0.05) return "Finished down";
  return "Finished level";
}
