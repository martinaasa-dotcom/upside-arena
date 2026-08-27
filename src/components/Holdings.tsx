import { cn } from "@/lib/utils";
import { formatMoney, formatPercent } from "@/lib/format";
import { displaySymbol, holdingUnit } from "@/lib/coins";
import type { Position } from "@/lib/game/portfolio";

/*
  One row per company. Fixed height, never wrapping to two lines, so a glance
  down the column is enough to read the week.
*/
export function Holdings({ positions }: { positions: Position[] }) {
  return (
    <div className="flex flex-col gap-2">
      {positions.map((position) => {
        const up = position.gain >= 0;
        return (
          <div
            key={position.symbol}
            className={cn(
              "glass-well flex h-14 items-center gap-3 rounded-lg px-4",
              // A left edge in the gain or loss colour is allowed. A tinted
              // fill across the whole row is not.
              up ? "border-l-4 border-l-gain" : "border-l-4 border-l-loss"
            )}
          >
            <span className="figure w-16 shrink-0 text-sm font-semibold">
              {displaySymbol(position.symbol)}
            </span>

            {/*
              Sized to its own text rather than to a fixed twenty. The column
              is fixed-height and this used to be a fixed width, so a four
              figure holding wrapped onto a second line inside it -- which the
              wide-screen layout made ordinary rather than rare, because a
              panel in the narrower column is half the width the fixed number
              was chosen at. Now the name beside it truncates instead, which is
              the thing that can afford to.
            */}
            <span className="figure hidden shrink-0 whitespace-nowrap text-sm text-muted-foreground sm:block">
              {position.quantity} {holdingUnit(position.symbol, position.quantity)}
            </span>

            <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
              {position.quote?.name ?? ""}
            </span>

            <span className="flex shrink-0 flex-col items-end">
              <span className="figure text-sm font-semibold">
                {formatMoney(position.value)}
              </span>
              <span
                className={cn("figure text-xs", up ? "text-gain" : "text-loss")}
              >
                {formatPercent(position.gainPercent)}
              </span>
            </span>
          </div>
        );
      })}
    </div>
  );
}
