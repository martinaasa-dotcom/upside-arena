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
import { PAGE, STACK } from "@/lib/page-shell";
import { formatGap, formatMoney, formatPercent } from "@/lib/format";

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

async function MoneyScore({ params }: Params) {
  const view = await battleFor(params);
  if (!view) return <Score label="Your money" value="—" as="text" />;

  return (
    <Score
      label="Your money"
      value={formatMoney(view.you?.totalValue ?? view.battle.startingBalance)}
      hint={`Started with ${formatMoney(view.battle.startingBalance)}`}
    />
  );
}

async function ReturnScore({ params }: Params) {
  const view = await battleFor(params);
  if (!view) return <Score label="This battle" value="—" as="text" />;

  const pct = view.you?.returnPercent ?? 0;

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

  return (
    <Score
      label="Cash left"
      value={view ? formatMoney(view.cash) : "—"}
      as={view ? "figure" : "text"}
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

      {battle.finished ? (
        <Panel
          title="This battle is over"
          description="Settled on the closing prices of its last day. Nothing here counted towards your record, a season or a streak — a battle is between the people in it and nobody else."
        />
      ) : (
        <Panel title="Trade">
          <TradeForm
            cash={view.cash}
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
    </>
  );
}
