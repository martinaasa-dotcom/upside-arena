import { cn } from "@/lib/utils";
import { formatMoney, formatPercent, initials } from "@/lib/format";
import type { RevealedBook } from "@/lib/game/books";

/*
  What everybody turned out to be holding.

  "How were you up nine per cent" is the first thing anybody asks when a
  contest ends, and until now Arena had no answer to it -- a league could see
  who won and nothing whatsoever about how. A scoreboard with no reveal is a
  result without a story, and the story is the part people talk about.

  Only after it is settled. While a contest is running this same panel is a
  copying machine: whoever is in front is visible to everybody behind them,
  and a league converges on one book by Wednesday.

  Facts only, and deliberately no valuation. What they held, how much of it,
  and what it cost them -- all of which are what they were and cannot change.
  Settling does not clear holdings and these rooms price them live, so a
  "worth" column here would go on moving for ever after a contest nobody can
  trade in any more.
*/
export function Reveal({ books }: { books: RevealedBook[] }) {
  if (books.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      {books.map((book) => {
        const spent = book.positions.reduce((sum, position) => sum + position.costBasis, 0);

        return (
          <div key={book.userId} className="glass-well flex flex-col gap-2 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <span className="figure w-6 shrink-0 text-sm text-muted-foreground">
                {book.rank}
              </span>
              <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-medium text-muted-foreground">
                {initials(book.displayName)}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-medium">
                {book.displayName}
              </span>
              <span
                className={cn(
                  "figure shrink-0 text-sm font-semibold",
                  book.returnPercent >= 0 ? "text-gain" : "text-loss"
                )}
              >
                {formatPercent(book.returnPercent)}
              </span>
            </div>

            {book.positions.length === 0 ? (
              /*
                Holding nothing at the end is two different people, and calling
                both of them the same thing is unfair to one of them.

                Somebody who traded and sold up made a decision, and in a week
                the market fell it is a winning one. Somebody who never traded
                did not decide anything -- they missed it -- and telling their
                league they "stayed in cash" puts a strategy in their mouth
                that they never had.
              */
              <p className="text-sm text-muted-foreground">
                {book.traded
                  ? "Sold up before the end and finished in cash."
                  : "Never traded in this one."}
              </p>
            ) : (
              <>
                <div className="flex flex-wrap gap-1.5">
                  {book.positions.map((position) => (
                    <span
                      key={position.symbol}
                      className="flex items-baseline gap-1.5 rounded-md bg-foreground/[0.06] px-2 py-1"
                    >
                      <span className="figure text-xs font-medium">{position.symbol}</span>
                      <span className="figure text-xs text-muted-foreground">
                        {formatMoney(position.costBasis)}
                      </span>
                    </span>
                  ))}
                </div>

                {/*
                  What they did not put to work. Only said when there is
                  enough of it to be a decision rather than the change left
                  over from one.
                */}
                {book.cash > spent * 0.05 ? (
                  <p className="text-sm text-muted-foreground">
                    Kept <span className="figure">{formatMoney(book.cash)}</span> in cash.
                  </p>
                ) : null}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** The heading a settled contest's reveal sits under. */
export function revealTitle(books: RevealedBook[]): string {
  const winner = books.find((book) => book.rank === 1);
  return winner ? `What ${winner.displayName} did, and everybody else` : "What everybody held";
}
