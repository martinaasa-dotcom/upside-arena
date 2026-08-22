import Link from "next/link";
import { ArrowRight, Crown, Minus } from "lucide-react";
import { Panel, Well } from "@/components/Panel";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatPercent, initials, ordinal, plural } from "@/lib/format";
import type { HeadToHead, Honour, RecordedWeek } from "@/lib/game/record";

/*
  What a league remembers, drawn three ways.

  The strip is what goes on the league page: five weeks, who won each, and one
  sentence about how the viewer has done. It is small on purpose -- the league
  page is about this week, and this is the reminder that there was a last one.

  The board and the head-to-head are the record room, where somebody has gone
  looking.
*/

/** The last few weeks, as a row of who won them. */
export function FormStrip({
  weeks,
  you,
  href,
}: {
  weeks: RecordedWeek[];
  you: Honour | null;
  href: string;
}) {
  if (weeks.length === 0) return null;

  // Oldest first, so it reads left to right the way a season does.
  const shown = [...weeks].reverse();

  return (
    <Panel
      title="Form"
      description={
        you && you.weeks > 0
          ? `You have won ${plural(you.wins, "week")} of the ${you.weeks} you have played here.`
          : "Weeks this league has already played."
      }
      action={
        <Button asChild variant="ghost" size="sm">
          <Link href={href}>
            The record
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </Button>
      }
    >
      <div className="flex flex-wrap gap-2">
        {shown.map((week) => {
          const won = week.you?.rank === 1;

          return (
            <Well
              key={week.cycleId}
              className={cn(
                "flex min-w-0 flex-1 basis-32 flex-col gap-1 py-3",
                won && "ring-1 ring-primary/40"
              )}
            >
              <span className="figure text-xs text-muted-foreground">
                {shortDate(week.monday)}
              </span>

              <span className="flex min-w-0 items-center gap-1.5">
                <Crown
                  className={cn(
                    "size-3.5 shrink-0",
                    won ? "text-primary" : "text-muted-foreground"
                  )}
                  aria-hidden="true"
                />
                <span className="truncate text-sm font-medium">
                  {won ? "You" : (week.winner?.displayName ?? "Nobody")}
                </span>
              </span>

              {week.you ? (
                <span
                  className={cn(
                    "figure text-xs",
                    week.you.returnPercent >= 0 ? "text-gain" : "text-loss"
                  )}
                >
                  {ordinal(week.you.rank)} of {week.players},{" "}
                  {formatPercent(week.you.returnPercent)}
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">
                  You did not play
                </span>
              )}
            </Well>
          );
        })}
      </div>
    </Panel>
  );
}

/** Weeks won, all time, in this league. */
export function HonoursBoard({ honours }: { honours: Honour[] }) {
  return (
    <div className="flex flex-col gap-2">
      {honours.map((row, index) => (
        <div
          key={row.userId}
          className={cn(
            "glass-well flex min-h-14 items-center gap-3 rounded-lg px-4 py-2",
            row.isYou && "ring-1 ring-primary/40"
          )}
        >
          <span className="figure w-6 shrink-0 text-sm text-muted-foreground">
            {index + 1}
          </span>

          <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-medium text-muted-foreground">
            {initials(row.displayName)}
          </span>

          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm font-medium">
              {row.displayName}
              {row.isYou ? <span className="ml-2 text-xs text-primary">You</span> : null}
            </span>

            {/*
              Everything on one line under the name on a phone, and in a column
              on the right on anything wider.

              In one row at 390px the wins and the market figure took enough
              width that "31 weeks played, best +128.5%" wrapped to three lines
              and the name above it truncated to "Aleksan…" -- a row four lines
              tall that had lost the only thing it was for.
            */}
            <span className="figure text-xs text-muted-foreground sm:hidden">
              <span className="text-foreground">{plural(row.wins, "win")}</span>
              {" \u00b7 "}
              {plural(row.weeks, "week")}
              {" \u00b7 "}
              <span
                className={row.averageVersusMarket >= 0 ? "text-gain" : "text-loss"}
              >
                {formatPercent(row.averageVersusMarket)} vs market
              </span>
            </span>

            <span className="hidden text-xs text-muted-foreground sm:inline">
              {plural(row.weeks, "week")} played
              {row.bestWeek == null
                ? ""
                : `, best ${formatPercent(row.bestWeek)}`}
            </span>
          </span>

          <span className="hidden shrink-0 flex-col items-end sm:flex">
            <span className="figure text-sm font-semibold">
              {plural(row.wins, "win")}
            </span>
            <span
              className={cn(
                "figure text-xs",
                row.averageVersusMarket >= 0 ? "text-gain" : "text-loss"
              )}
            >
              {formatPercent(row.averageVersusMarket)} vs market
            </span>
          </span>
        </div>
      ))}
    </div>
  );
}

/** How the viewer has done against each person, one at a time. */
export function HeadToHeadTable({ rows }: { rows: HeadToHead[] }) {
  return (
    <div className="flex flex-col gap-2">
      {rows.map((row) => {
        const drawn = row.together - row.won - row.lost;
        const ahead = row.won > row.lost;

        return (
          <div
            key={row.userId}
            className="glass-well flex min-h-14 items-center gap-3 rounded-lg px-4 py-2"
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-medium text-muted-foreground">
              {initials(row.displayName)}
            </span>

            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm font-medium">{row.displayName}</span>
              <span className="text-xs text-muted-foreground">
                {plural(row.together, "week")} you both played
                {drawn > 0 ? `, ${drawn} level` : ""}
              </span>
            </span>

            <span className="flex shrink-0 items-center gap-2">
              {row.won === row.lost ? (
                <Minus className="size-3.5 text-muted-foreground" aria-hidden="true" />
              ) : null}
              <span
                className={cn(
                  "figure text-sm font-semibold",
                  row.won === row.lost
                    ? "text-muted-foreground"
                    : ahead
                      ? "text-gain"
                      : "text-loss"
                )}
              >
                {row.won}&ndash;{row.lost}
              </span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Every week, newest first. */
export function WeekLog({ weeks }: { weeks: RecordedWeek[] }) {
  return (
    <div className="flex flex-col gap-2">
      {weeks.map((week) => (
        <div
          key={week.cycleId}
          className="glass-well flex min-h-14 items-center gap-3 rounded-lg px-4 py-2"
        >
          <span className="figure w-20 shrink-0 text-sm text-muted-foreground">
            {shortDate(week.monday)}
          </span>

          <span className="flex min-w-0 flex-1 items-center gap-1.5">
            <Crown className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
            <span className="truncate text-sm font-medium">
              {week.winner?.displayName ?? "Nobody"}
            </span>
            {/*
              What the winner made is the first thing to go when the row runs
              out of width. At 390px it left the name about twenty pixels, so
              the winner rendered as "A…" -- and who won is the entire point of
              the row, while what they made by is a detail beside it.
            */}
            {week.winner ? (
              <span
                className={cn(
                  "figure hidden shrink-0 text-xs sm:inline",
                  week.winner.returnPercent >= 0 ? "text-gain" : "text-loss"
                )}
              >
                {formatPercent(week.winner.returnPercent)}
              </span>
            ) : null}
          </span>

          <span className="flex shrink-0 flex-col items-end">
            {week.you ? (
              <>
                <span className="figure text-sm">
                  {ordinal(week.you.rank)} of {week.players}
                </span>
                <span
                  className={cn(
                    "figure text-xs",
                    week.you.returnPercent >= 0 ? "text-gain" : "text-loss"
                  )}
                >
                  {formatPercent(week.you.returnPercent)}
                </span>
              </>
            ) : (
              <span className="text-xs text-muted-foreground">
                You did not play
              </span>
            )}
          </span>
        </div>
      ))}
    </div>
  );
}

/*
  "18 Aug", without a year. Every date on this screen is inside the last year
  or two and the column is being scanned rather than read, so the year is four
  characters of noise in every row.
*/
const SHORT = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });

function shortDate(iso: string) {
  return SHORT.format(new Date(`${iso}T12:00:00Z`));
}

/**
 * Every week somebody has played, on their own profile.
 *
 * The same shape as the league's week log and deliberately not the same
 * component: this one has no winner, because a personal record is not a table
 * of other people. What it has instead is the market, which is the thing a
 * week is actually measured against.
 */
export function PlayedWeeks({
  weeks,
}: {
  weeks: {
    cycleId: string;
    monday: string;
    returnPercent: number;
    versusMarket: number | null;
  }[];
}) {
  return (
    <div className="flex flex-col gap-2">
      {weeks.map((week) => {
        const up = week.returnPercent >= 0;
        const beat = week.versusMarket != null && week.versusMarket > 0;

        return (
          <div
            key={week.cycleId}
            className={cn(
              "glass-well flex min-h-14 items-center gap-3 rounded-lg px-4 py-2",
              beat ? "border-l-4 border-l-gain" : "border-l-4 border-l-border"
            )}
          >
            <span className="figure w-20 shrink-0 text-sm text-muted-foreground">
              {shortDate(week.monday)}
            </span>

            {/*
              A figure rather than a sentence.

              "Beat the market by 10.8%" is the clearer thing to read and it is
              the wrong thing to put in the middle of a row on a phone: between
              a date and a percentage it had about ninety pixels and rendered
              as "Beat the market…", which says less than nothing. The pair on
              the right is the shape the honours board already uses, and the
              aqua edge says the same thing again without any words at all.
            */}
            <span className="min-w-0 flex-1" />

            <span className="flex shrink-0 flex-col items-end">
              <span
                className={cn(
                  "figure text-sm font-semibold",
                  up ? "text-gain" : "text-loss"
                )}
              >
                {formatPercent(week.returnPercent)}
              </span>
              <span
                className={cn(
                  "figure text-xs",
                  week.versusMarket == null
                    ? "text-muted-foreground"
                    : beat
                      ? "text-gain"
                      : "text-loss"
                )}
              >
                {week.versusMarket == null
                  ? "market not recorded"
                  : `${formatPercent(week.versusMarket)} vs market`}
              </span>
            </span>
          </div>
        );
      })}
    </div>
  );
}
