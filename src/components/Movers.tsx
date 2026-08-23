import Link from "next/link";
import { Panel } from "@/components/Panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatMoney, formatPercent } from "@/lib/format";
import type { Mover, MoversView } from "@/lib/market/movers";

/*
  What moved today.

  Two rows of four rather than one list of eight, because up and down are the
  two things somebody is actually looking for and mixing them makes the reader
  do the sorting.

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
      description="The largest real moves among companies you would recognise, and anything you own. A big move is not a reason to buy something. It is just what happened."
      action={
        movers.anyStale ? (
          <Badge variant="warning">Prices are catching up</Badge>
        ) : (
          <Button asChild variant="ghost" size="sm">
            <Link href="/trade">Trade</Link>
          </Button>
        )
      }
    >
      <div className="flex flex-col gap-4">
        <Column label="Up" rows={movers.up} />
        <Column label="Down" rows={movers.down} />
      </div>
    </Panel>
  );
}

function Column({ label, rows }: { label: string; rows: Mover[] }) {
  if (rows.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs tracking-wide text-muted-foreground uppercase">
        {label}
      </span>

      {/*
        Two across a phone, four across anything wider. One across is a column
        of four rows that says less than a sentence would; five across is a
        ticker, which is decoration.
      */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {rows.map((row) => {
          const up = row.changePercent >= 0;

          return (
            /*
              A link rather than a tile.

              Somebody who has just read a name and decided something about it
              is one tap from acting on it, and without this that tap landed on
              an empty search box asking them to type what they had just read.
              It goes to the trade screen with the company already chosen; it
              buys nothing, and the number of shares is still theirs to say.
            */
            <Link
              key={row.symbol}
              href={`/trade?symbol=${encodeURIComponent(row.symbol)}`}
              className={cn(
                "glass-well flex min-w-0 flex-col gap-0.5 rounded-lg px-3 py-2.5 transition-colors",
                "hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                up ? "border-l-4 border-l-gain" : "border-l-4 border-l-loss"
              )}
            >
              <span className="flex min-w-0 items-baseline justify-between gap-2">
                <span className="figure truncate text-sm font-semibold">
                  {row.symbol}
                </span>
                {row.owned ? (
                  <span className="shrink-0 text-xs text-primary">Yours</span>
                ) : null}
              </span>

              {/*
                What the company is actually called.

                This panel exists to show "companies you would recognise" and
                was showing four letters. F is Ford and DIS is Disney to
                somebody who already knows, and to everybody else they are
                four letters with a percentage next to them -- on the one
                screen in Arena whose job is to introduce a company to a
                person who has not met it.

                The name was already being fetched and carried the whole way
                here. It was thrown away at the last step.
              */}
              {row.name ? (
                <span className="truncate text-xs text-muted-foreground">
                  {row.name}
                </span>
              ) : null}

              <span
                className={cn(
                  "figure text-sm font-semibold",
                  up ? "text-gain" : "text-loss"
                )}
              >
                {formatPercent(row.changePercent)}
              </span>

              <span className="figure truncate text-xs text-muted-foreground">
                {formatMoney(row.price, "USD", 2)}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
