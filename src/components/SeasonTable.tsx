import { cn } from "@/lib/utils";
import { formatPercent, initials, plural } from "@/lib/format";
import type { SeasonStanding } from "@/lib/game/seasons";

/*
  The season table.

  Ordered on points ahead of the market per week, which is the same measure a
  week is scored on, just averaged. Total return is deliberately not the
  ordering: over thirteen weeks of an identical start each, adding returns up
  would rank whoever turned up most often rather than whoever played best.

  Somebody too new to be ranked still appears, shown where they would stand
  and told how many weeks are left before it counts. A table you are missing
  from is not one you can see yourself climbing.
*/
export function SeasonTable({ standings }: { standings: SeasonStanding[] }) {
  return (
    <div className="flex flex-col gap-2">
      {standings.map((row) => {
        const ahead = row.averageVersusMarket >= 0;

        return (
          <div
            key={row.userId}
            className={cn(
              "glass-well flex h-14 items-center gap-3 rounded-lg px-4",
              row.isYou ? "ring-1 ring-primary/40" : null,
              // Unranked rows are quieter, not hidden. They are still real.
              row.ranked ? null : "opacity-70"
            )}
          >
            <span className="figure w-6 shrink-0 text-sm text-muted-foreground">
              {row.ranked ? (row.rank ?? row.position) : "–"}
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
              <span className="text-xs text-muted-foreground">
                {row.weeksAhead} of {plural(row.weeksPlayed, "week")} ahead of the
                market
              </span>
            </span>

            <span className="flex shrink-0 flex-col items-end">
              <span
                className={cn(
                  "figure text-sm font-semibold",
                  ahead ? "text-gain" : "text-loss"
                )}
              >
                {formatPercent(row.averageVersusMarket)}
              </span>
              <span className="text-xs text-muted-foreground">a week</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}
