import { formatGap, formatPercent, ordinal, plural } from "@/lib/format";

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
  /**
   * The week as five days, Monday first, in percent against the starting
   * balance at each close. A null is a day the player was not here for --
   * somebody who signed up on the Wednesday has two of them.
   *
   * Cards written before this was laid out by date hold a shorter, denser
   * list, so everything that reads it copes with fewer than five.
   */
  marks: (number | null)[];
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
export function sparkline(marks: readonly (number | null)[]): string {
  const played = marks.filter((mark): mark is number => mark != null);
  if (played.length === 0) return "";

  /*
    A day nobody played is a space rather than a block. It has to be
    something -- dropping it would slide Friday under Wednesday and make the
    row say the same untrue thing the drawn card used to -- and a space is
    the one character that reads as "not this day" in a message with no
    styling and no way to add a caption.
  */
  const gap = " ";

  const low = Math.min(...played);
  const high = Math.max(...played);
  const range = high - low;

  // Every day the same. A middle block reads as level; the lowest would read
  // as a bad week that never happened.
  if (range < 0.0001) {
    return marks.map((mark) => (mark == null ? gap : BLOCKS[3])).join("");
  }

  return marks
    .map((mark) => {
      if (mark == null) return gap;
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

/*
  "2nd of 6". There were two of these for a while, one here and one in
  lib/format, each with its own tests, each correct — which is how a third one
  nearly got written. Re-exported rather than moved so the share card's
  callers keep importing what they always did.
*/
export { ordinal } from "@/lib/format";

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
