import { cn } from "@/lib/utils";
import { formatMoney, formatPercent, initials } from "@/lib/format";
import { GoalMark } from "@/components/WeeklyGoal";
import type { Standing } from "@/lib/game/leagues";

/*
  The league table. One fixed-height row per person, so a glance down the
  column tells you where you are.

  It has a header now, which it did not need while there was one figure per
  row and did the moment there were two. Two percentages side by side with
  nothing naming them is a puzzle, and the answer -- one is the week, one is
  today -- is the whole reason the second one is worth showing.

  The day column appears only when the day is a thing that has happened. It
  is null for everybody at once or for nobody: at the weekend, before the
  bell, and on a Monday there is no close behind today, so rather than a
  column of noughts there is no column.
*/
export function StandingsTable({
  standings,
  goalFor,
}: {
  standings: Standing[];
  /*
    What this person said they would do this week, if anything. A goal is
    shown under the name rather than in a column of its own, because most
    weeks most people will not have declared one and an empty column reads as
    a missing value rather than as a choice nobody made.
  */
  goalFor?: (userId: string) => { label: string; met: boolean | null } | null;
}) {
  const showToday = standings.some((row) => row.todayPercent != null);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3 px-4 text-xs text-muted-foreground">
        {/* Standing in for the rank and the initials, so the labels line up
            with the figures they name rather than with the names. */}
        <span className="w-6 shrink-0" aria-hidden="true" />
        <span className="size-8 shrink-0" aria-hidden="true" />
        <span className="min-w-0 flex-1">Player</span>
        {showToday ? (
          <span className="hidden w-16 shrink-0 text-right sm:block">Today</span>
        ) : null}
        <span className="w-20 shrink-0 text-right">Week</span>
      </div>

      {standings.map((row) => {
        const up = row.returnPercent >= 0;
        const today = row.todayPercent;

        const tone =
          today == null
            ? "text-muted-foreground"
            : today >= 0
              ? "text-gain/90"
              : "text-loss/90";

        return (
          <div
            key={row.userId}
            className={cn(
              // A minimum, not a fixed height: a declared goal adds a second
              // line under the name, and it wraps on a narrow phone.
              "flex min-h-14 items-center gap-3 rounded-lg px-4 py-2",
              // Your own row is marked with the accent, so finding yourself
              // takes no reading at all.
              row.isYou
                ? "glass-well ring-1 ring-primary/40"
                : "glass-well"
            )}
          >
            <span className="figure w-6 shrink-0 text-sm text-muted-foreground">
              {row.rank}
            </span>

            <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-medium text-muted-foreground">
              {initials(row.displayName)}
            </span>

            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm font-medium">
                {row.displayName}
                {row.isYou ? (
                  <span className="ml-2 text-xs text-primary">You</span>
                ) : null}
              </span>
              {(() => {
                const goal = goalFor?.(row.userId);
                if (goal) return <GoalMark label={goal.label} met={goal.met} />;
                if (!row.hasTraded) {
                  return (
                    <span className="truncate text-xs text-muted-foreground">
                      No trades yet
                    </span>
                  );
                }
                return null;
              })()}
            </span>

            {/*
              Today, quieter than the week, because the week is what the
              table is ranked by and the eye should land there first.

              A column of its own only where there is width for a third one.
              At 390px three figures beside a name left the name about four
              characters, so on a phone it rides under the week instead and
              says the word "today" so it needs no header to explain it.
            */}
            {showToday ? (
              <span
                className={cn("figure hidden w-16 shrink-0 text-right text-sm sm:block", tone)}
              >
                {today == null ? "—" : formatPercent(today)}
              </span>
            ) : null}

            {/*
              A minimum rather than a width. "-12.4% today" is wider than the
              percentage above it, and a fixed box would have let it spill
              sideways into somebody’s name. Growing instead makes the name
              give up the characters, which is the right one to lose.
            */}
            <span className="flex min-w-20 shrink-0 flex-col items-end">
              <span
                className={cn("figure text-sm font-semibold", up ? "text-gain" : "text-loss")}
              >
                {formatPercent(row.returnPercent)}
              </span>

              {showToday && today != null ? (
                <span className={cn("figure text-xs sm:hidden", tone)}>
                  {formatPercent(today)} today
                </span>
              ) : null}
              {/*
                What it is worth. It gives up its place on a phone to the
                day, which is the newer news, and only when there is a day
                to give it up to -- a battle has none, so there it stays.
              */}
              <span
                className={cn(
                  "figure text-xs text-muted-foreground",
                  showToday ? "hidden sm:block" : "block"
                )}
              >
                {formatMoney(row.totalValue)}
              </span>
            </span>
          </div>
        );
      })}
    </div>
  );
}
