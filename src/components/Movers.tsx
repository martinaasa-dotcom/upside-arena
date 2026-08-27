import { Panel } from "@/components/Panel";
import { cn } from "@/lib/utils";
import { formatPercent } from "@/lib/format";
import { displaySymbol } from "@/lib/coins";
import type { Mover, MoversView } from "@/lib/market/movers";

/*
  What moved today.

  Two lists rather than one, because up and down are the two things somebody
  is actually looking for and mixing them makes the reader do the sorting.

  Lists, not a grid of chips. A chip is how this product offers a name to be
  picked (the draft board, a format's universe). A list is how it reports a
  ranking (standings, the sample on the signed-out page). This panel is the
  second thing.

  Each row is a name and a percent. The share price is not drawn: that is
  the number a buy ticket needs, and this is not a ticket. The tiles used
  to be links into a pre-filled trade, which is a recommendation, whatever
  the sentence above them claimed. "Yours" is a fact about the row, not a
  door into the book. The Trade room is in the dock.

  The description is load-bearing and is not hedging. A screen that shows a
  company up nine per cent and says nothing else is a screen that reads as a
  suggestion, and this product has a sixteen year old minimum age and says
  plainly everywhere else that it gives no advice. So it says it here too, in
  the words somebody would use.
*/
export function Movers({ movers }: { movers: MoversView }) {
  return (
    <Panel
      title="What moved today"
      description="The largest real moves among names you would recognise, and anything you own. A big move is not a reason to buy something. It is just what happened."
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Column label="Up" rows={movers.up} />
        <Column label="Down" rows={movers.down} />
      </div>
    </Panel>
  );
}

function Column({ label, rows }: { label: string; rows: Mover[] }) {
  if (rows.length === 0) return null;

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <span className="text-xs tracking-wide text-muted-foreground uppercase">
        {label}
      </span>
      <ol
        aria-label={label}
        className="glass-well m-0 list-none divide-y divide-border overflow-hidden rounded-lg p-0"
      >
        {rows.map((row) => (
          <MoverRow key={row.symbol} row={row} />
        ))}
      </ol>
    </div>
  );
}

function MoverRow({ row }: { row: Mover }) {
  const up = row.changePercent >= 0;

  return (
    <li className="flex min-h-10 items-center gap-3 px-3 py-2">
      <span className="figure shrink-0 whitespace-nowrap text-sm font-semibold">
        {displaySymbol(row.symbol)}
      </span>
      {row.name ? (
        <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
          {row.name}
        </span>
      ) : (
        <span className="min-w-0 flex-1" />
      )}
      {row.owned ? (
        <span className="shrink-0 text-xs text-primary">Yours</span>
      ) : null}
      <span
        className={cn(
          "figure shrink-0 whitespace-nowrap text-sm font-semibold",
          up ? "text-gain" : "text-loss"
        )}
      >
        {formatPercent(row.changePercent)}
      </span>
    </li>
  );
}
