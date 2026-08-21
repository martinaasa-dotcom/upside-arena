import { Panel, Well } from "@/components/Panel";
import { WeekShape } from "@/components/WeekShape";
import { ShareWeek } from "@/components/ShareWeek";
import { headline, ordinal, versusMarketLine, weekLabel } from "@/lib/share/card";
import type { Recap } from "@/lib/share/card";
import { formatPercent, plural } from "@/lib/format";

/*
  Last week, on the home screen, once it has been scored.

  Shown to everybody whose week finished, not only to the people who did well.
  A recap that only appears after a good week is a recap nobody trusts, and
  the share loop needs both halves: the plan is blunt that virality comes from
  a card people are willing to post win or lose.
*/
export function WeekRecap({ recap }: { recap: Recap }) {
  const up = recap.returnPercent >= 0;
  const versus = versusMarketLine(recap.benchmarkDiff);

  return (
    <Panel
      title="Last week"
      description={`Scored and closed. Week of ${weekLabel(recap.monday)}.`}
    >
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-1">
            <p
              className={`figure text-4xl font-semibold tabular-nums ${
                up ? "text-gain" : "text-loss"
              }`}
            >
              {formatPercent(recap.returnPercent)}
            </p>
            <p className="font-semibold tracking-tight">{headline(recap)}</p>
            {versus ? <p className="text-sm text-muted-foreground">{versus}</p> : null}
          </div>

          {recap.marks.length > 0 ? (
            <div className="w-full max-w-56 sm:w-56">
              <WeekShape marks={recap.marks} />
            </div>
          ) : null}
        </div>

        {recap.league || recap.streakDays > 0 ? (
          <Well className="flex flex-wrap items-center gap-x-6 gap-y-2 py-3">
            {recap.league ? (
              <p className="text-sm">
                <span className="text-muted-foreground">Finished </span>
                {ordinal(recap.league.rank)} of {recap.league.size}
                <span className="text-muted-foreground"> in {recap.league.name}</span>
              </p>
            ) : null}
            {recap.streakDays > 0 ? (
              <p className="text-sm text-muted-foreground">
                {plural(recap.streakDays, "day")} in a row
              </p>
            ) : null}
          </Well>
        ) : null}

        <ShareWeek />
      </div>
    </Panel>
  );
}
