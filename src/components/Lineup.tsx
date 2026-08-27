"use client";

import {
  useActionState,
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
} from "react";
import { CalendarClock, Loader2, Search, X } from "lucide-react";
import { toast } from "sonner";
import { Panel, Well } from "@/components/Panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { track } from "@/lib/analytics";
import { NO_VALUE, formatDate, formatMoney } from "@/lib/format";
import { lookupSymbols } from "@/app/(app)/trade/actions";
import { HouseholdCoinChips } from "@/components/CoinChips";
import {
  coinFromSymbol,
  displaySymbol,
  holdingUnit,
  isCoinPair,
} from "@/lib/coins";
import {
  submitClearLineupOrder,
  submitLineupOrder,
  type LineupState,
} from "@/app/(app)/trade/lineup-actions";
import type { LineupView } from "@/lib/game/lineup";
import type { SymbolMatch } from "@/lib/market/quotes";

function asMatch(symbol: string): SymbolMatch {
  const coin = coinFromSymbol(symbol);
  return {
    symbol,
    name: coin?.name ?? symbol,
    exchange: coin ? "CCC" : null,
  };
}

/*
  What the weekend is for.

  Same search and the same whole-shares rule as the trade form, and
  deliberately not the same component: this places no order and moves no
  money. It records an intention that is carried out on Monday at the opening
  price, and every line of copy on this screen exists to make sure nobody
  confuses the two. A person who thinks they have bought something and has not
  is worse off than a person who was told to come back Monday.
*/
export function Lineup({ view }: { view: LineupView }) {
  const [state, formAction, pending] = useActionState<LineupState, FormData>(
    submitLineupOrder,
    {}
  );
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<SymbolMatch | null>(null);
  const [matches, setMatches] = useState<SymbolMatch[]>([]);
  const [searching, setSearching] = useState(false);
  const [quantity, setQuantity] = useState("");
  const [removing, startRemoving] = useTransition();

  const searchId = useId();
  const quantityId = useId();
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    track("lineup_viewed");
  }, []);

  const [handled, setHandled] = useState(state.success);
  if (state.success !== handled) {
    setHandled(state.success);
    if (state.success) {
      setPicked(null);
      setQuery("");
      setQuantity("");
      setMatches([]);
    }
  }

  useEffect(() => {
    if (state.success) {
      toast.success(state.success);
      formRef.current?.reset();
      track("lineup_order_queued");
    }
  }, [state.success]);

  useEffect(() => {
    const term = query.trim();
    if (picked || term.length < 1) return;

    let cancelled = false;

    const timer = window.setTimeout(async () => {
      setSearching(true);
      const found = await lookupSymbols(term);
      if (cancelled) return;
      setMatches(found);
      setSearching(false);
    }, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, picked]);

  const shares = Number(quantity);
  const validShares = Number.isInteger(shares) && shares > 0;
  const showMatches = !picked && query.trim().length > 0 && matches.length > 0;

  const waiting = view.orders.filter((order) => !order.ran);
  const full = waiting.length >= view.maxOrders;
  const left = view.startingBalance - view.estimate;

  return (
    <div className="flex flex-col gap-6">
      <Panel
        title={`Monday's lineup`}
        description={`Say what you want to own and it is bought for you at the opening price on ${formatDate(`${view.monday}T12:00:00Z`)}. Everybody fills at that same price, so there is no advantage in doing this early or late.`}
      >
        {waiting.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nothing lined up. You start Monday with{" "}
            {formatMoney(view.startingBalance)} in cash either way. A lineup only
            saves you doing it at half past nine.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {/*
              Two lines on a phone, one on anything wider.

              In a single row at 390px the ticker, the share count, the company
              name, the estimate and the remove button left the name about
              twenty pixels, so "Alphabet Inc." rendered as "A…". A name
              truncated to one letter is not a shorter name, it is a missing
              one.
            */}
            {waiting.map((order) => (
              <Well
                key={order.id}
                className="flex items-center gap-3 py-3"
              >
                <span className="flex min-w-0 flex-1 flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-3">
                  <span className="flex items-baseline gap-3 sm:contents">
                    <span className="figure shrink-0 text-sm font-semibold sm:w-16">
                      {displaySymbol(order.symbol)}
                    </span>
                    <span className="figure shrink-0 text-sm text-muted-foreground sm:w-24">
                      {order.quantity} {holdingUnit(order.symbol, order.quantity)}
                    </span>
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                    {order.name ?? ""}
                  </span>
                </span>
                {/*
                  Against the first line, not floating between the two. Centred
                  in a two-line row it sat level with neither the ticker above
                  it nor the company name below, which reads as a number that
                  belongs to some other row.
                */}
                <span className="figure shrink-0 self-start text-right text-sm sm:self-center">
                  {order.estimate == null ? NO_VALUE : `about ${formatMoney(order.estimate)}`}
                </span>
                {view.locked ? null : (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="shrink-0"
                    disabled={removing}
                    aria-label={`Take ${displaySymbol(order.symbol)} out of the lineup`}
                    onClick={() =>
                      startRemoving(async () => {
                        /*
                          Said out loud either way. The market can open between
                          this page being drawn and this button being tapped,
                          and a lineup that quietly refuses to change is worse
                          than one that says it is set.

                          The catch is the other half of that. A call that
                          never arrives -- a phone that has gone offline, a
                          server that answered with nothing -- would otherwise
                          throw straight past this and take the whole screen to
                          the error boundary, which is a louder way of telling
                          somebody nothing.
                        */
                        try {
                          const result = await submitClearLineupOrder(order.id);

                          if (!result.ok) {
                            toast.error(result.error ?? "We could not take that out.");
                            return;
                          }

                          track("lineup_order_cleared");
                          toast.success(`${displaySymbol(order.symbol)} taken out.`);
                        } catch {
                          toast.error("We could not reach the server. Try again.");
                        }
                      })
                    }
                  >
                    <X className="size-4" aria-hidden="true" />
                  </Button>
                )}
              </Well>
            ))}

            <p className="text-sm text-muted-foreground">
              About {formatMoney(view.estimate)} at today&apos;s prices, leaving
              roughly {formatMoney(Math.max(left, 0))} in cash. Monday&apos;s open
              is not today&apos;s price, so treat both as an estimate. Orders are
              filled in the order you added them, and anything there is no longer
              cash for is left and says so.
            </p>
          </div>
        )}
      </Panel>

      {view.locked ? (
        <Panel>
          <p className="text-sm text-warning">
            The market has opened, so this week&apos;s lineup is set. Trade
            directly instead.
          </p>
        </Panel>
      ) : (
        <Panel
          title="Add a company"
          description={`Up to ${view.maxOrders} names. You can change any of it until the bell on Monday, and none of it after.`}
        >
          <form ref={formRef} action={formAction} className="flex flex-col gap-5">
            <input type="hidden" name="symbol" value={picked?.symbol ?? ""} />

            <div className="flex flex-col gap-1.5">
              <Label htmlFor={searchId}>Company</Label>

              {picked ? (
                <Well className="flex items-center justify-between gap-3 py-3">
                  <span className="min-w-0">
                    <span className="figure text-sm font-semibold">
                      {displaySymbol(picked.symbol)}
                    </span>
                    <span className="ml-2 truncate text-sm text-muted-foreground">
                      {picked.name}
                    </span>
                  </span>
                  <div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setPicked(null);
                        setQuery("");
                      }}
                    >
                      Change
                    </Button>
                  </div>
                </Well>
              ) : (
                <>
                  <div className="relative">
                    <Search
                      className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <Input
                      id={searchId}
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Apple, NVDA, or Bitcoin"
                      autoComplete="off"
                      className="pl-9"
                    />
                    {searching ? (
                      <Loader2
                        className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground"
                        aria-hidden="true"
                      />
                    ) : null}
                  </div>

                  <HouseholdCoinChips
                    onPick={(symbol) => {
                      setPicked(asMatch(symbol));
                      setQuery("");
                      setMatches([]);
                    }}
                  />

                  {showMatches ? (
                    <ul className="mt-1 flex flex-col gap-px overflow-hidden rounded-lg bg-border">
                      {matches.map((match) => (
                        <li key={match.symbol}>
                          <button
                            type="button"
                            onClick={() => {
                              setPicked(match);
                              setMatches([]);
                            }}
                            className={cn(
                              "flex w-full items-center gap-3 bg-[color-mix(in_oklch,var(--muted),transparent_50%)] px-4 py-3 text-left transition-colors",
                              "hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                            )}
                          >
                            <span className="figure w-16 shrink-0 text-sm font-semibold">
                              {displaySymbol(match.symbol)}
                            </span>
                            <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                              {match.name}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor={quantityId}>
                {picked && isCoinPair(picked.symbol) ? "How many?" : "How many shares?"}
              </Label>
              <Input
                id={quantityId}
                name="quantity"
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
                placeholder="10"
                aria-describedby={`${quantityId}-hint`}
              />
              <p id={`${quantityId}-hint`} className="text-sm text-muted-foreground">
                {picked && isCoinPair(picked.symbol)
                  ? `Whole ${holdingUnit(picked.symbol, 2)} only.`
                  : "Whole shares only."}{" "}
                You will have {formatMoney(view.startingBalance)} on Monday morning.
              </p>
            </div>

            {state.error ? (
              <p role="alert" className="text-sm text-loss">
                {state.error}
              </p>
            ) : null}

            {full ? (
              <p className="text-sm text-warning">
                A lineup holds {view.maxOrders} names. Take one out to add
                another.
              </p>
            ) : null}

            <div>
              <Button
                type="submit"
                size="lg"
                disabled={pending || !picked || !validShares || full}
              >
                <CalendarClock className="size-4" aria-hidden="true" />
                {pending ? "Saving" : "Line it up"}
              </Button>
            </div>
          </form>
        </Panel>
      )}
    </div>
  );
}

/** What a lineup did, for the one line the home screen says about it. */
export function LineupReport({
  filled,
  missed,
}: {
  filled: number;
  missed: { symbol: string; detail: string | null }[];
}) {
  useEffect(() => {
    track("lineup_filled", { filled, missed: missed.length });
  }, [filled, missed.length]);

  if (filled === 0 && missed.length === 0) return null;

  return (
    <Panel
      title="Your lineup ran"
      description={`Bought at Monday's opening price, which is what everybody who left a lineup paid.`}
    >
      <div className="flex flex-col gap-2">
        <p className="text-sm">
          {filled === 0
            ? "None of it went through."
            : `${filled} of ${filled + missed.length} ${
                filled + missed.length === 1 ? "order" : "orders"
              } went through.`}
        </p>

        {missed.map((order) => (
          <Well key={order.symbol} className="flex items-start gap-3 py-3">
            <span className="figure w-16 shrink-0 text-sm font-semibold">
              {displaySymbol(order.symbol)}
            </span>
            <span className="min-w-0 flex-1 text-sm text-muted-foreground">
              {order.detail ?? "This one did not run."}
            </span>
          </Well>
        ))}
      </div>
    </Panel>
  );
}
