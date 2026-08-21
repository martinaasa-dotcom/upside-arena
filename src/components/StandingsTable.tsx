import { cn } from "@/lib/utils";
import { formatMoney, formatPercent, initials } from "@/lib/format";
import type { Standing } from "@/lib/game/leagues";

/*
  The league table. One fixed-height row per person, so a glance down the
  column tells you where you are.
*/
export function StandingsTable({ standings }: { standings: Standing[] }) {
  return (
    <div className="flex flex-col gap-2">
      {standings.map((row) => {
        const up = row.returnPercent >= 0;
        return (
          <div
            key={row.userId}
            className={cn(
              "flex h-14 items-center gap-3 rounded-lg px-4",
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
              {!row.hasTraded ? (
                <span className="text-xs text-muted-foreground">
                  Has not traded yet
                </span>
              ) : null}
            </span>

            <span className="flex shrink-0 flex-col items-end">
              <span
                className={cn("figure text-sm font-semibold", up ? "text-gain" : "text-loss")}
              >
                {formatPercent(row.returnPercent)}
              </span>
              <span className="figure text-xs text-muted-foreground">
                {formatMoney(row.totalValue)}
              </span>
            </span>
          </div>
        );
      })}
    </div>
  );
}
