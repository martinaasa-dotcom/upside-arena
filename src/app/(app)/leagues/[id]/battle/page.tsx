import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Panel, Well } from "@/components/Panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Holdings } from "@/components/Holdings";
import { Score, Scoreboard } from "@/components/Scoreboard";
import { StandingsTable } from "@/components/StandingsTable";
import { TradeForm } from "@/components/TradeForm";
import { TrackView } from "@/components/TrackView";
import { getSession } from "@/lib/profile";
import { getBattleView, getLeagueBattle } from "@/lib/game/battles";
import { allowedSymbols } from "@/lib/game/formats";
import { submitCancelBattle } from "@/app/(app)/leagues/battle-actions";
import { COLUMN, PAGE, SPLIT, STACK } from "@/lib/page-shell";
import { formatGap, formatMoney, formatPercent, ordinal } from "@/lib/format";

/*
  The battle room.

  Deliberately one screen rather than a room with tabs. A battle is small: a
  table, what you own in it, and a way to trade under its rules. Splitting
  those across three routes would make the interesting one -- the table --
  something you have to navigate back to after every trade.

  The way back and the four labels on the scoreboard are the room and need
  nothing, so they are prerendered and land with the tap. Everything priced
  streams in under them: this is the most expensive read in the app, because
  it values every member's book from live quotes, and it is exactly the room
  that most needs to paint before it knows any of that.
*/

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { user } = await getSession();
  if (!user) return { title: "Battle" };

  const battle = await getLeagueBattle(user.id, (await params).id);
  return { title: battle ? `${battle.format.name} battle` : "Battle" };
}

export default function BattlePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <div className={`${PAGE} ${STACK}`}>
      <TrackView event="battle_viewed" />

      <div>
        <Suspense
          fallback={
            <Button variant="ghost" size="sm" className="-ml-2 mb-2" disabled>
              <ArrowLeft />
              Back
            </Button>
          }
        >
          <BackToLeague params={params} />
        </Suspense>
      </div>

      {/*
        The labels are prerendered and the figures arrive into them, the same
        way Home does it. "Cash left" is true before the number is.
      */}
      <Scoreboard>
        <Suspense fallback={<Score label="Your money" value="—" as="text" />}>
          <MoneyScore params={params} />
        </Suspense>
        <Suspense fallback={<Score label="This battle" value="—" as="text" />}>
          <ReturnScore params={params} />
        </Suspense>
        <Suspense
          fallback={
            <Score
              label="The benchmark"
              value="—"
              as="text"
              hint="What this battle is measured against"
            />
          }
        >
          <BenchmarkScore params={params} />
        </Suspense>
        <Suspense
          fallback={
            <Score label="Cash left" value="—" as="text" hint="Cash earns nothing" />
          }
        >
          <CashScore params={params} />
        </Suspense>
      </Scoreboard>

      <Suspense fallback={null}>
        <Rest params={params} />
      </Suspense>

      <Well className="py-3">
        <p className="text-sm text-muted-foreground">
          A battle changes nothing about the ordinary week. Your streak, your
          record and the season are the week everybody plays, and they carry on
          while this runs.{" "}
          <Link href="/how" className="underline">
            How Arena works
          </Link>
          .
        </p>
      </Well>
    </div>
  );
}

type Params = { params: Promise<{ id: string }> };

/**
 * The battle behind this route, or nothing.
 *
 * Every piece below asks through here rather than being handed one, because
 * each is its own boundary and they resolve independently. getBattleView is
 * memoised for the length of the request, so eight callers cost one read of
 * the league and one batch of quotes between them.
 */
async function battleFor(params: Promise<{ id: string }>) {
  const { user } = await getSession();
  if (!user) return null;

  const { id } = await params;
  const summary = await getLeagueBattle(user.id, id);
  if (!summary) return null;

  return getBattleView(user.id, summary.cycleId);
}

async function BackToLeague({ params }: Params) {
  const { id } = await params;

  return (
    <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2">
      <Link href={`/leagues/${id}`}>
        <ArrowLeft />
        Back to the league
      </Link>
    </Button>
  );
}

/*
  Four figures that are all the viewer's, and null for anybody who was not in
  this contest -- a member who joined the league after it had ended can open
  the room, and has no money in it. A dash is the honest answer; a hundred
  thousand and nought per cent would be a week they never played.
*/
async function MoneyScore({ params }: Params) {
  const view = await battleFor(params);
  if (!view?.you) return <Score label="Your money" value="—" as="text" />;

  return (
    <Score
      label="Your money"
      value={formatMoney(view.you.totalValue)}
      hint={`Started with ${formatMoney(view.battle.startingBalance)}`}
    />
  );
}

async function ReturnScore({ params }: Params) {
  const view = await battleFor(params);
  if (!view) return <Score label="This battle" value="—" as="text" />;

  if (!view.you) {
    return (
      <Score
        label="This battle"
        value="Not you"
        as="text"
        hint={`${view.battle.length.name}, ended ${view.battle.endsOn}`}
      />
    );
  }

  const pct = view.you.returnPercent;

  return (
    <Score
      label="This battle"
      value={formatPercent(pct)}
      tone={pct >= 0 ? "gain" : "loss"}
      hint={`${view.battle.length.name}, ending ${view.battle.endsOn}`}
    />
  );
}

async function BenchmarkScore({ params }: Params) {
  const view = await battleFor(params);
  const pct = view?.benchmarkReturnPercent ?? null;

  return (
    <Score
      label={view?.battle.benchmarkSymbol ?? "The benchmark"}
      value={pct == null ? "Not yet" : formatPercent(pct)}
      as={pct == null ? "text" : "figure"}
      tone={pct == null ? "neutral" : pct >= 0 ? "gain" : "loss"}
      hint="What this battle is measured against"
    />
  );
}

async function CashScore({ params }: Params) {
  const view = await battleFor(params);
  const cash = view?.cash ?? null;

  return (
    <Score
      label="Cash left"
      value={cash == null ? "—" : formatMoney(cash)}
      as={cash == null ? "text" : "figure"}
      hint="Cash earns nothing"
    />
  );
}

/*
  Everything below the scoreboard, which is one region because it is one
  scroll: the rules, the table, what you hold, and the way to trade under it.
*/
async function Rest({ params }: Params) {
  const { user } = await getSession();
  if (!user) redirect("/");

  const { id } = await params;
  const summary = await getLeagueBattle(user.id, id);

  // No battle, not a member, or no such league. All of them are "nothing here
  // for you", and telling them apart confirms a league exists to a guesser.
  if (!summary) notFound();

  const view = await getBattleView(user.id, summary.cycleId);
  if (!view) notFound();

  const { battle, standings, you, positions } = view;
  const format = battle.format;
  const ahead = you && you.rank > 1 ? standings[you.rank - 2] : null;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2">
          <span aria-hidden="true">{format.icon}</span>
          {format.name}
        </h1>
        <div className="flex items-center gap-2">
          {view.anyStale ? (
            <Badge variant="warning">Prices are catching up</Badge>
          ) : null}
          <Badge variant={battle.finished ? "outline" : "gain"}>
            {battle.finished ? "Finished" : battle.timeLeft}
          </Badge>
          <Badge variant="outline">Play money</Badge>
        </div>
      </div>

      <p className="-mt-2 text-sm text-muted-foreground">{format.rule}</p>

      {/*
        The table on the left, the way to trade under its rules on the right.

        This is the room the split was worth building for: on a wide screen the
        standings and the form are side by side, so placing an order and seeing
        what it did to the table is one glance rather than a scroll each way.
      */}
      <div className={SPLIT}>
        <div className={COLUMN}>

      {/*
        Who won, before anything else.

        A battle used to settle and simply stop: the room showed the same table
        it had shown all week and a sentence saying it was over, and whoever
        had won had to work that out by reading the top row. A contest with no
        moment at the end of it is one people play once.
      */}
      {battle.finished && standings.length > 0 ? (
        <Panel>
          <p className="text-sm">
            {you?.rank === 1 ? (
              <>
                <span className="font-semibold text-primary">You won.</span>{" "}
                {standings.length > 1
                  ? `First of ${standings.length} in ${format.name}, at `
                  : `You were the only one who played it, and finished at `}
                <span
                  className={
                    (you?.returnPercent ?? 0) >= 0
                      ? "figure text-gain"
                      : "figure text-loss"
                  }
                >
                  {formatPercent(you?.returnPercent ?? 0)}
                </span>
                .
              </>
            ) : (
              <>
                <span className="font-semibold">{standings[0].displayName}</span> won{" "}
                {format.name}, at{" "}
                <span
                  className={
                    standings[0].returnPercent >= 0
                      ? "figure text-gain"
                      : "figure text-loss"
                  }
                >
                  {formatPercent(standings[0].returnPercent)}
                </span>
                .
                {you
                  ? ` You finished ${ordinal(you.rank)} of ${standings.length}.`
                  : " You did not play this one."}
              </>
            )}
          </p>
        </Panel>
      ) : null}

      {ahead && you ? (
        <Panel>
          <p className="text-sm">
            You are{" "}
            <span className="figure text-loss">
              {formatGap(ahead.returnPercent - you.returnPercent)}
            </span>{" "}
            behind <span className="font-semibold">{ahead.displayName}</span>.{" "}
            <span className="text-muted-foreground">
              Under these rules, that is closer than it looks.
            </span>
          </p>
        </Panel>
      ) : null}

      <Panel
        title="The table"
        description={`Everybody in ${battle.leagueName} started with the same money on ${battle.startsOn}.`}
      >
        <StandingsTable standings={standings} />
      </Panel>

        </div>

        <div className={COLUMN}>

      {positions.length > 0 ? (
        <Panel
          title={format.direction === "short" ? "What you are short" : "What you own"}
          description={
            format.direction === "short"
              ? "These gain when the price falls. A name can never cost you more than you put into it."
              : undefined
          }
        >
          <Holdings positions={positions} />
        </Panel>
      ) : null}

      {/*
        Whether they were in it comes first.

        This asked whether the battle had finished first, which put the panel
        below it -- written for somebody who joined the league afterwards --
        behind a branch that is true in exactly the case it was written for.
        They saw the generic "this battle is over" card, and the specific one
        only ever appeared in the few hours between a contest ending and the
        settle noticing.
      */}
      {!you ? (
        /*
          Somebody who was not in this contest. Only reachable once it has
          ended: a running battle ends in the future, so everybody in the
          league now was in it.
        */
        <Panel
          title="You were not in this one"
          description="It had already finished by the time you joined the league. The table above is who played it."
        >
          <Button asChild variant="outline" size="sm">
            <Link href={`/leagues/${id}`}>Back to the league</Link>
          </Button>
        </Panel>
      ) : battle.finished ? (
        <Panel
          title="This battle is over"
          description="Settled on the closing prices of its last day. Nothing here counted towards your record, a season or a streak — a battle is between the people in it and nobody else."
        >
          <Button asChild variant="outline" size="sm">
            <Link href={`/leagues/${id}`}>Back to the league</Link>
          </Button>
        </Panel>
      ) : (
        <Panel title="Trade">
          <TradeForm
            cash={view.cash ?? 0}
            ownedSymbols={positions.map((p) => p.symbol)}
            tradingOpen={view.tradingOpen}
            closedReason={view.closedReason}
            battleId={battle.cycleId}
            universe={allowedSymbols(format)}
            rule={format.rule}
          />
        </Panel>
      )}

      {battle.isYours && !battle.finished ? (
        <Panel
          title="Call it off"
          description="Only you can, because you started it. The battle and everything played in it goes: nothing is settled and nobody gets a result. There is no honest way to shorten one instead, because the result would cover a stretch nobody agreed to."
        >
          <form action={submitCancelBattle}>
            <input type="hidden" name="leagueId" value={id} />
            <input type="hidden" name="cycleId" value={battle.cycleId} />
            <Button type="submit" variant="outline">
              Call off this battle
            </Button>
          </form>
        </Panel>
      ) : null}

        </div>
      </div>
    </>
  );
}
