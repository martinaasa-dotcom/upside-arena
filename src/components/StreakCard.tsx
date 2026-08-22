import { Check, Coins, Flame, Snowflake } from "lucide-react";
import { Panel, Well } from "@/components/Panel";
import { cn } from "@/lib/utils";
import { plural } from "@/lib/format";
import type { Streak } from "@/lib/game/streaks";

/*
  The streak.

  A progress bar toward the next title, because an unfinished thing pulls
  harder than a finished one. A plain "you are done for today" when the day is
  counted, because section 3 asks for a natural stopping point rather than a
  screen that never lets you feel finished.

  No countdown, no warning about what you are about to lose. Loss aversion
  here comes from the number itself being real.
*/
export function StreakCard({ streak }: { streak: Streak }) {
  const { current, longest, freezesAvailable, nextMilestone, toNextMilestone } =
    streak;

  const from = nextMilestone
    ? Math.max(0, nextMilestone.at - (toNextMilestone ?? 0))
    : current;
  const progress = nextMilestone
    ? Math.round((from / nextMilestone.at) * 100)
    : 100;

  return (
    <Panel
      title="Your streak"
      description={
        current === 0
          ? "Open Arena on a weekday to start one."
          : "Trading days in a row. Weekends do not count against you."
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <span
            className={cn(
              "flex size-14 shrink-0 items-center justify-center rounded-xl",
              current > 0
                ? "bg-primary/10 text-primary ring-1 ring-primary/20"
                : "glass-well text-muted-foreground"
            )}
            aria-hidden="true"
          >
            <Flame className="size-6" />
          </span>

          <div className="flex min-w-0 flex-col">
            <span className="figure text-2xl font-bold">
              {current}
              <span className="ml-1.5 text-sm font-normal text-muted-foreground">
                {current === 1 ? "day" : "days"}
              </span>
            </span>
            <span className="text-sm text-muted-foreground">
              {/*
                Kept on one line. "Longest 12 days" broke after the number on
                a narrow phone, which read as two separate facts rather than
                one, and left the row looking broken next to the flame.
              */}
              <span className="whitespace-nowrap">
                Longest {longest === 0 ? "none yet" : plural(longest, "day")}
              </span>
            </span>
          </div>

          {streak.countedToday ? (
            <span className="ml-auto flex shrink-0 items-center gap-1.5 text-sm whitespace-nowrap text-gain">
              <Check className="size-4" aria-hidden="true" />
              Counted today
            </span>
          ) : null}
        </div>

        {nextMilestone && toNextMilestone != null ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="text-muted-foreground">
                {toNextMilestone} more for &ldquo;{nextMilestone.name}&rdquo;
              </span>
              <span className="figure text-xs text-muted-foreground">
                {from}/{nextMilestone.at}
              </span>
            </div>
            <div
              className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-valuenow={from}
              aria-valuemin={0}
              aria-valuemax={nextMilestone.at}
              aria-label={`Progress toward ${nextMilestone.name}`}
            >
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        ) : null}

        <Well className="flex items-center gap-3 py-3">
          <Coins className="size-4 shrink-0 text-primary" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">
            {/*
              A day count, never an amount. How much a milestone pays is not
              worked out until it is reached, and quoting a figure we have not
              decided would be the one fabricated part of an otherwise honest
              mechanic.
            */}
            {streak.toNextBonus === 1
              ? "One more day and there are coins in it"
              : `${streak.toNextBonus} more days and there are coins in it`}
            {streak.nextBonusHasDrop
              ? ", and something to wear with them."
              : "."}
          </p>
        </Well>

        <Well className="flex items-center gap-3 py-3">
          <Snowflake className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">
            {freezesAvailable > 0 ? (
              <>
                You have {plural(freezesAvailable, "freeze")}. Miss a day and
                one is used automatically, so the streak holds.
              </>
            ) : (
              <>
                No freezes left. You get another one on Monday.
              </>
            )}
          </p>
        </Well>
      </div>
    </Panel>
  );
}
