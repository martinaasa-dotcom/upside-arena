"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { track } from "@/lib/analytics";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Segmented } from "@/components/Segmented";
import { Well } from "@/components/Panel";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/format";
import { lookupSymbols, submitTrade, type TradeState } from "@/app/(app)/trade/actions";
import type { SymbolMatch } from "@/lib/market/quotes";

const SIDES = [
  { value: "buy" as const, label: "Buy" },
  { value: "sell" as const, label: "Sell" },
];

/*
  One form, two rooms.

  The trade screen plays the house week and a battle room plays a league's own
  contest, and the only differences between them are which contest the order
  belongs to and what may be bought in it. Two forms would be two places for
  the same bug about whole shares, or stale prices, or a button that stays
  enabled after the bell.

  A format that names its companies one by one is offered as a grid rather
  than a search box. That is not decoration: search is the only part of this
  screen that can offer something the rules will then refuse, and a list
  cannot.
*/
export function TradeForm({
  cash,
  ownedSymbols,
  tradingOpen,
  closedReason,
  battleId,
  universe,
  rule,
}: {
  cash: number;
  ownedSymbols: string[];
  tradingOpen: boolean;
  closedReason: string;
  /** The battle this order is for. Absent means the house week. */
  battleId?: string;
  /** Every name the format allows, when it names them. Null means search. */
  universe?: readonly string[] | null;
  /** The format's rule, in the words the player is held to. */
  rule?: string | null;
}) {
  const [state, formAction, pending] = useActionState<TradeState, FormData>(
    submitTrade,
    {}
  );
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<SymbolMatch | null>(null);
  const [matches, setMatches] = useState<SymbolMatch[]>([]);
  const [searching, setSearching] = useState(false);
  const [quantity, setQuantity] = useState("");

  const searchId = useId();
  const quantityId = useId();
  const formRef = useRef<HTMLFormElement>(null);

  /*
    Clear the form once a trade goes through. Adjusting state during render is
    React's own answer for reacting to a changed input, and it avoids the extra
    pass an effect would cost.
  */
  const [handledSuccess, setHandledSuccess] = useState(state.success);
  if (state.success !== handledSuccess) {
    setHandledSuccess(state.success);
    if (state.success) {
      setPicked(null);
      setQuery("");
      setQuantity("");
      setMatches([]);
    }
  }

  // Announcing the fill is a side effect, so it stays in one.
  useEffect(() => {
    if (state.success) {
      toast.success(state.success);
      formRef.current?.reset();
      // Which side, and nothing else. What they bought is theirs.
      track("trade_placed");
    }
  }, [state.success]);

  useEffect(() => {
    // A rejected trade is worth more than a filled one: it is somebody trying
    // to do something the game would not let them.
    if (state.error) track("trade_rejected");
  }, [state.error]);

  // Search as you type, but only once typing pauses. Every keystroke would be
  // a request to an outside service for a company nobody meant to look up.
  useEffect(() => {
    const term = query.trim();
    if (picked || term.length < 1 || universe) return;

    let cancelled = false;

    const timer = window.setTimeout(async () => {
      setSearching(true);
      const found = await lookupSymbols(term, battleId);
      if (cancelled) return;
      setMatches(found);
      setSearching(false);
      // Whether a search found anything, never what was typed.
      track("symbol_searched", { found: found.length });
    }, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, picked, universe, battleId]);

  const shares = Number(quantity);
  const validShares = Number.isInteger(shares) && shares > 0;
  // Derived rather than cleared in an effect, so a stale list cannot flash
  // back up between a keystroke and the next search.
  const showMatches =
    !universe && !picked && query.trim().length > 0 && matches.length > 0;

  /*
    Selling is always from what is held, whatever the format allows. A rule
    that could trap somebody in a position would be a punishment rather than a
    game, so the grid narrows to what they own rather than refusing.
  */
  const offered = universe
    ? side === "sell"
      ? universe.filter((symbol) => ownedSymbols.includes(symbol))
      : universe
    : null;

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-5">
      <input type="hidden" name="side" value={side} />
      <input type="hidden" name="symbol" value={picked?.symbol ?? ""} />
      {battleId ? <input type="hidden" name="battleId" value={battleId} /> : null}

      {rule ? (
        <Well className="py-3">
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">The rule:</span> {rule}
          </p>
        </Well>
      ) : null}

      <div className="flex flex-col gap-2">
        <Label>What do you want to do?</Label>
        <Segmented
          label="Buy or sell"
          options={SIDES}
          value={side}
          onValueChange={(next) => {
            setSide(next);
            setPicked(null);
            setQuery("");
          }}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        {/*
          The grid has no input to point at, and a label whose `for` names an
          id that is not on the page is a broken label rather than a spare one.
        */}
        {!picked && offered ? (
          <span
            id={`${searchId}-grid-label`}
            className="text-sm leading-none font-medium"
          >
            What to trade
          </span>
        ) : (
          <Label htmlFor={searchId}>Company</Label>
        )}

        {!picked && offered ? (
          offered.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              You are not holding anything in this battle yet.
            </p>
          ) : (
            <div
              role="radiogroup"
              aria-labelledby={`${searchId}-grid-label`}
              className="grid grid-cols-3 gap-2 sm:grid-cols-4"
            >
              {offered.map((symbol) => (
                <button
                  key={symbol}
                  type="button"
                  role="radio"
                  aria-checked={false}
                  onClick={() => setPicked({ symbol, name: symbol, exchange: null })}
                  className={cn(
                    "figure h-11 rounded-lg border border-border text-sm font-semibold transition-colors",
                    "hover:bg-foreground/5 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                    ownedSymbols.includes(symbol) && "border-primary/50 text-primary"
                  )}
                >
                  {symbol.replace(/-USD$/, "")}
                </button>
              ))}
            </div>
          )
        ) : picked ? (
          <Well className="flex items-center justify-between gap-3 py-3">
            <span className="min-w-0">
              <span className="figure text-sm font-semibold">{picked.symbol}</span>
              <span className="ml-2 truncate text-sm text-muted-foreground">
                {picked.name}
              </span>
            </span>
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
                placeholder={
                  side === "sell" ? "Search what you own" : "Search a company or ticker"
                }
                autoComplete="off"
                className="pl-9"
                aria-describedby={`${searchId}-hint`}
              />
              {searching ? (
                <Loader2
                  className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground"
                  aria-hidden="true"
                />
              ) : null}
            </div>

            <p id={`${searchId}-hint`} className="text-sm text-muted-foreground">
              {side === "sell" && ownedSymbols.length > 0
                ? `You own ${ownedSymbols.join(", ")}.`
                : "Try a name like Apple, or a ticker like AAPL."}
            </p>

            {showMatches ? (
              <ul className="mt-1 flex flex-col gap-px overflow-hidden rounded-lg bg-border">
                {matches.map((match) => {
                  const owned = ownedSymbols.includes(match.symbol);
                  return (
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
                          {match.symbol}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                          {match.name}
                        </span>
                        {side === "sell" && owned ? (
                          <span className="shrink-0 text-xs text-primary">Owned</span>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={quantityId}>How many shares?</Label>
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
          Whole shares only. You have {formatMoney(cash)} to spend.
        </p>
      </div>

      {state.error ? (
        <p role="alert" className="text-sm text-loss">
          {state.error}
        </p>
      ) : null}

      {!tradingOpen ? (
        <p className="text-sm text-warning">{closedReason}</p>
      ) : null}

      <div>
        <Button
          type="submit"
          size="lg"
          disabled={pending || !picked || !validShares || !tradingOpen}
        >
          {pending
            ? "Placing"
            : side === "buy"
              ? `Buy ${picked?.symbol ?? "shares"}`
              : `Sell ${picked?.symbol ?? "shares"}`}
        </Button>
      </div>

      {/*
        No estimated cost is shown before the trade. The price moves between
        looking and clicking, and a number that turns out wrong reads as the
        game cheating. The filled price is reported afterwards instead.
      */}
      <p className="text-sm text-muted-foreground">
        You will be filled at the price when your trade goes through, which may
        differ a little from what you see now. Prices are about fifteen minutes
        behind the market.
      </p>
    </form>
  );
}
