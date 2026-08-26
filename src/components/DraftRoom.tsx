"use client";

import {
  useActionState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { Check, Clock, ListOrdered, Timer, Users } from "lucide-react";
import { Panel, Well } from "@/components/Panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { track } from "@/lib/analytics";
import { formatMoney } from "@/lib/format";
import type { DraftShell, DraftState } from "@/lib/game/draft";
import {
  MIN_SEATS,
  POLL_MS,
  draftProgress,
  pickClockLabel,
} from "@/lib/game/draft-order";
import {
  pollDraft,
  submitCancelDraft,
  submitJoinDraft,
  submitLeaveDraft,
  submitPick,
  submitStartDraft,
  type DraftFormState,
} from "@/app/(app)/leagues/draft-actions";

/*
  The draft room. The one screen in Arena that several people watch at once.

  What it is doing, in one paragraph, because the shape is unusual for this
  app. The half that does not move -- the board's company names, the rule book,
  what a pick is worth -- is rendered on the server and handed down as `shell`.
  The half that does move is fetched on an interval and nothing else on the
  page re-renders when it lands. That split is what keeps a two second poll
  cheap enough to be worth having: it is one indexed read, not a page.

  Three things are deliberate and easy to undo by accident:

  **The countdown runs off an offset, not off the browser's clock.** The
  deadline belongs to the server and the phone in somebody's hand may be a
  minute out either way. Every poll carries the server's own `now`, and the
  difference is what the countdown is drawn through.

  **The poll is what runs the clock.** There is no scheduler here. When a turn
  runs out it is the next poll from anybody in the room that notices, and since
  the database checks the deadline itself under a lock, five phones noticing at
  once is fine: one of them moves the draft on and the rest find nothing to do.

  **A tap polls immediately rather than waiting for the interval.** Two seconds
  between taking a name and seeing it appear is two seconds of wondering
  whether the tap worked, and in a room where somebody else may be reaching for
  the same name that is exactly the moment not to be silent.
*/
export function DraftRoom({
  shell,
  initial,
}: {
  shell: DraftShell;
  initial: DraftState;
}) {
  const [state, setState] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [picking, setPicking] = useState<string | null>(null);

  /*
    How far the browser's clock is from the server's, in milliseconds.

    A ref rather than state: it changes on every poll and nothing should
    re-render because of it. The countdown reads it when it ticks.
  */
  const skew = useRef(0);

  const apply = useCallback((next: DraftState | null) => {
    if (!next) return;
    skew.current = Date.now() - next.now;
    setState(next);
  }, []);

  const refresh = useCallback(async () => {
    try {
      apply(await pollDraft(shell.id));
    } catch {
      /*
        A poll that fails changes nothing on screen.

        The room keeps whatever it last knew and asks again in two seconds,
        because a dropped request on a train is not news and an error banner
        over a live draft is worse than a board that is two seconds stale.
      */
    }
  }, [apply, shell.id]);

  useEffect(() => {
    if (state.status === "filled") return;

    const id = window.setInterval(() => void refresh(), POLL_MS);

    /*
      And once on coming back, because a phone that went in a pocket stopped
      firing intervals and the board it is holding may be a whole round old.
    */
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh, state.status]);

  const yourTurn = state.onTheClock?.isYou === true;

  const take = useCallback(
    async (symbol: string) => {
      if (!yourTurn || picking) return;
      setPicking(symbol);
      setError(null);
      try {
        const result = await submitPick(shell.id, symbol);
        if (result.error) setError(result.error);
        else track("draft_pick_made", { format: shell.format.id });
      } catch {
        setError("That did not go through. Try again.");
      } finally {
        setPicking(null);
        void refresh();
      }
    },
    [picking, refresh, shell.format.id, shell.id, yourTurn]
  );

  if (state.status === "waiting") {
    return <Lobby shell={shell} state={state} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <OnTheClock shell={shell} state={state} skew={skew} onExpire={refresh} />

      {error ? (
        <p role="alert" className="text-sm text-loss">
          {error}
        </p>
      ) : null}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <DraftBoard
          shell={shell}
          state={state}
          yourTurn={yourTurn}
          picking={picking}
          onPick={take}
        />
        <DraftRunningOrder shell={shell} state={state} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------------ */

function Lobby({ shell, state }: { shell: DraftShell; state: DraftState }) {
  const [start, startAction, starting] = useActionState<DraftFormState, FormData>(
    submitStartDraft,
    {}
  );

  return (
    <Panel
      title="Everybody in?"
      description={`${shell.format.name}, ${shell.rounds} names each, ${pickClockLabel(shell.pickSeconds).toLowerCase()}. Nothing is decided until it starts.`}
    >
      <div className="flex flex-col gap-5">
        <ul className="divide-y divide-border">
          {state.seats.map((seat) => (
            <li key={seat.userId} className="flex h-10 items-center gap-3">
              <Users className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate text-sm">
                {seat.name}
                {seat.isYou ? (
                  <span className="text-muted-foreground"> (you)</span>
                ) : null}
              </span>
              <Check className="size-4 shrink-0 text-gain" aria-hidden="true" />
            </li>
          ))}
        </ul>

        <Well className="flex flex-col gap-1.5">
          <p className="text-sm">
            Seats are dealt at random when it starts, and the order snakes: last
            in the first round is first in the second.
          </p>
          <p className="text-sm text-muted-foreground">
            Each pick is worth {formatMoney(shell.budget)}, the same for
            everybody, bought at Monday&rsquo;s opening price.
          </p>
        </Well>

        {start.error ? (
          <p role="alert" className="text-sm text-loss">
            {start.error}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          {shell.isOpener ? (
            <form action={startAction}>
              <input type="hidden" name="draftId" value={shell.id} />
              <Button
                type="submit"
                size="lg"
                disabled={starting || state.seats.length < MIN_SEATS}
                onClick={() => track("draft_started", { format: shell.format.id })}
              >
                <ListOrdered className="size-4" aria-hidden="true" />
                {starting ? "Dealing" : "Deal the seats"}
              </Button>
            </form>
          ) : state.youAreSeated ? (
            <form action={submitLeaveDraft}>
              <input type="hidden" name="draftId" value={shell.id} />
              <Button type="submit" variant="outline">
                Leave
              </Button>
            </form>
          ) : (
            <form action={submitJoinDraft}>
              <input type="hidden" name="draftId" value={shell.id} />
              <Button type="submit" size="lg">
                <Users className="size-4" aria-hidden="true" />
                I&rsquo;m in
              </Button>
            </form>
          )}

          <p className="text-sm text-muted-foreground">
            {state.seats.length < MIN_SEATS
              ? "Waiting for somebody else. Send them the league invite."
              : shell.isOpener
                ? `${state.seats.length} in. Start it when everybody is here.`
                : `${state.seats.length} in so far.`}
          </p>
        </div>

        {/*
          Offered only to somebody sitting in it, which is what the database
          allows. A form action has nowhere to put a refusal, so a button that
          quietly does nothing is worse than no button.
        */}
        {state.youAreSeated ? (
          <form action={submitCancelDraft}>
            <input type="hidden" name="draftId" value={shell.id} />
            <input type="hidden" name="leagueId" value={shell.leagueId} />
            <Button
              type="submit"
              variant="ghost"
              size="sm"
              className="-ml-2 text-muted-foreground"
            >
              Call it off
            </Button>
          </form>
        ) : null}
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------------------------ */

/**
 * Whose turn it is, and how long they have.
 *
 * The countdown is the only thing on this page that redraws four times a
 * second, so it is its own component: putting the tick in the room above would
 * re-render the board and the running order with it.
 */
function OnTheClock({
  shell,
  state,
  skew,
  onExpire,
}: {
  shell: DraftShell;
  state: DraftState;
  skew: React.RefObject<number>;
  onExpire: () => void;
}) {
  /*
    The clock is one piece of state and it is the wall clock, not the remaining
    time.

    Storing "seconds left" would mean writing it from inside the effect on
    every deadline change, which is a cascading render for a number that can be
    worked out during the render it is needed in. So the interval moves `now`
    on and everything else is derived.
  */
  const [now, setNow] = useState(() => Date.now());
  const fired = useRef<number | null>(null);

  useEffect(() => {
    if (state.deadline == null) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [state.deadline]);

  const left =
    state.deadline == null ? null : Math.max(0, state.deadline - (now - skew.current));

  /*
    Ask the server once when a turn runs out, rather than on every tick.

    The poll would notice within two seconds anyway; this moves the turn on at
    the moment the countdown reaches zero, which is when everybody in the room
    is looking at it. Keyed on the pick number so a turn is only ever nudged
    once however many times it re-renders at zero.
  */
  useEffect(() => {
    if (left !== 0) return;
    if (fired.current === state.currentPick) return;
    fired.current = state.currentPick;
    onExpire();
  }, [left, onExpire, state.currentPick]);

  if (state.status === "picked" || state.status === "filled") {
    return <AllPicked shell={shell} state={state} />;
  }

  const seconds = left == null ? null : Math.ceil(left / 1000);
  const fraction =
    left == null ? 0 : Math.min(1, left / (shell.pickSeconds * 1000));
  const yours = state.onTheClock?.isYou === true;

  return (
    <Panel>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="card-sheen glass-well rounded-xl p-2 text-primary">
              <Timer className="size-4" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-lg font-semibold tracking-tight">
                {yours ? "You are up" : `${state.onTheClock?.name ?? "Somebody"} is up`}
              </h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {draftProgress(state.currentPick, state.seats.length, shell.rounds)}
              </p>
            </div>
          </div>
          {seconds != null ? (
            <span
              className={cn(
                "font-mono text-2xl tabular-nums",
                seconds <= 5 ? "text-loss" : "text-foreground"
              )}
              aria-label={`${seconds} seconds left on this turn`}
            >
              {seconds}s
            </span>
          ) : null}
        </div>

        {/*
          The clock as a bar as well as a number.

          A number counting down is precise and easy to miss from across a
          table, which is the situation this whole screen is for.
        */}
        <div
          className="h-1 w-full overflow-hidden rounded-full bg-muted"
          role="presentation"
        >
          <div
            className={cn(
              "h-full rounded-full transition-[width] duration-200 ease-linear",
              fraction < 0.2 ? "bg-loss" : "bg-primary"
            )}
            style={{ width: `${Math.round(fraction * 100)}%` }}
          />
        </div>

        <p className="text-sm text-muted-foreground">
          {yours
            ? `Take a name off the board. ${formatMoney(shell.budget)} goes into it at Monday's open.`
            : state.yourTurnsAway == null
              ? "That is all your picks. Watch the rest of it go."
              : state.yourTurnsAway === 1
                ? "You are next."
                : `You are up in ${state.yourTurnsAway} turns.`}
        </p>
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------------------------ */

function AllPicked({ shell, state }: { shell: DraftShell; state: DraftState }) {
  const mine = state.turns.filter((turn) => turn.isYou);
  const bought = mine.some((turn) => turn.outcome != null);

  return (
    <Panel
      title={state.status === "filled" ? "Bought" : "That is the board"}
      description={
        state.status === "filled"
          ? "Everything was bought at Monday's opening price. You hold what you drafted until it settles."
          : `Nothing is owned yet. Every pick is bought at ${shell.format.tradingHours === "always" ? "the next open" : "Monday's opening price"}, the same price for everybody.`
      }
      action={
        state.status === "filled" ? (
          <Button asChild>
            <Link href={`/leagues/${shell.leagueId}/battle`}>Open the battle</Link>
          </Button>
        ) : null
      }
    >
      <ul className="divide-y divide-border">
        {mine.map((turn) => (
          <li key={turn.pickNumber} className="flex min-h-10 items-center gap-3 py-1">
            <span className="font-mono text-sm tabular-nums text-muted-foreground">
              {turn.round}
            </span>
            <span className="min-w-0 flex-1 truncate font-mono text-sm">
              {turn.symbol}
              {turn.byClock ? (
                <span className="ml-2 text-xs text-muted-foreground">
                  taken by the clock
                </span>
              ) : null}
            </span>
            {bought ? (
              <span className="shrink-0 text-right">
                {turn.outcome === "filled" ? (
                  <span className="font-mono text-sm tabular-nums">
                    {turn.shares} at {formatMoney(turn.fillPrice ?? 0)}
                  </span>
                ) : (
                  <span className="text-sm text-muted-foreground">
                    {turn.detail ?? "Not bought"}
                  </span>
                )}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </Panel>
  );
}

/* ------------------------------------------------------------------------ */

/*
  Exported so /gallery can measure it without the room around it.

  The room polls, and a polling component in the inventory would fire a server
  action every two seconds against a draft that does not exist. The board is
  also the case worth measuring: twenty-four tiles carrying a cashtag, a price
  and a company name is fine at 1440 and is exactly the shape that becomes a
  column of rubble at 390.
*/
export function DraftBoard({
  shell,
  state,
  yourTurn,
  picking,
  onPick,
}: {
  shell: DraftShell;
  state: DraftState;
  yourTurn: boolean;
  picking: string | null;
  /*
    Optional so the inventory can draw the board without one. A function prop
    cannot cross from a server component into a client one, and /gallery is a
    server component drawing this at every width a phone reports. It is only
    ever called when it is your turn, which the inventory's case is not.
  */
  onPick?: (symbol: string) => void;
}) {
  const left = useMemo(
    () => shell.board.filter((name) => !state.taken[name.symbol]).length,
    [shell.board, state.taken]
  );

  return (
    <Panel
      title="The board"
      description={`${left} of ${shell.board.length} still there.`}
    >
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {shell.board.map((name) => {
          const takenBy = state.taken[name.symbol];
          const busy = picking === name.symbol;
          const canTake = Boolean(onPick) && yourTurn && !takenBy && !picking;

          return (
            <button
              key={name.symbol}
              type="button"
              disabled={!canTake}
              onClick={() => onPick?.(name.symbol)}
              className={cn(
                "flex min-h-16 flex-col items-start justify-center gap-0.5 rounded-lg border px-3 py-2.5 text-left transition-colors",
                "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                takenBy
                  ? "border-border/50 text-muted-foreground opacity-50"
                  : canTake
                    ? "border-border hover:border-primary hover:bg-primary/10"
                    : "border-border/60 text-muted-foreground"
              )}
            >
              <span className="flex w-full items-baseline justify-between gap-2">
                <span
                  className={cn(
                    "font-mono text-sm font-medium",
                    takenBy && "line-through"
                  )}
                >
                  {name.symbol}
                </span>
                {name.price != null && !takenBy ? (
                  <span className="font-mono text-xs tabular-nums text-muted-foreground">
                    {formatMoney(name.price)}
                  </span>
                ) : null}
              </span>
              <span className="w-full truncate text-xs text-muted-foreground">
                {busy ? "Taking it" : (takenBy?.name ?? name.name ?? " ")}
              </span>
            </button>
          );
        })}
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------------------------ */

/**
 * The whole running order, taken and untaken.
 *
 * Written down before the first pick, which is what lets this be here at all,
 * and it is most of what makes a draft watchable for the four people who are
 * not currently picking. Seeing that you are up in two turns is the thing.
 */
export function DraftRunningOrder({
  shell,
  state,
}: {
  shell: DraftShell;
  state: DraftState;
}) {
  return (
    <Panel
      title="The order"
      description={`${state.seats.length} people, ${shell.rounds} each.`}
    >
      <ol className="divide-y divide-border">
        {state.turns.map((turn) => {
          const live = turn.pickNumber === state.currentPick && state.status === "picking";
          return (
            <li
              key={turn.pickNumber}
              className={cn(
                "flex h-10 items-center gap-3",
                live && "-mx-2 rounded-lg bg-foreground/5 px-2"
              )}
            >
              <span className="w-6 shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                {turn.pickNumber + 1}
              </span>
              <span
                className={cn(
                  "min-w-0 flex-1 truncate text-sm",
                  turn.isYou ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {turn.name}
                {turn.isYou ? " (you)" : ""}
              </span>
              {turn.symbol ? (
                <Badge variant="outline" className="shrink-0 font-mono">
                  {turn.symbol}
                </Badge>
              ) : live ? (
                <Clock className="size-4 shrink-0 text-primary" aria-hidden="true" />
              ) : (
                <ListOrdered
                  className="size-4 shrink-0 text-muted-foreground/40"
                  aria-hidden="true"
                />
              )}
            </li>
          );
        })}
      </ol>
    </Panel>
  );
}
