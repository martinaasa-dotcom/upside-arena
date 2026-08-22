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

export default async function BattlePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { user } = await getSession();
  if (!user) redirect("/");

  const { id } = await params;
  const battleSummary = await getLeagueBattle(user.id, id);

  // No battle, not a member, or no such league. All of them are "nothing here
  // for you", and telling them apart confirms a league exists to a guesser.
  if (!battleSummary) notFound();

  const view = await getBattleView(user.id, battleSummary.cycleId);
  if (!view) notFound();

  const { battle, standings, you, benchmarkReturnPercent, positions } = view;
  const format = battle.format;
  const ahead = you && you.rank > 1 ? standings[you.rank - 2] : null;

  return (
    <div className={`${PAGE} ${STACK}`}>
      <TrackView event="battle_viewed" properties={{ format: format.id }} />

      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2">
          <Link href={`/leagues/${id}`}>
            <ArrowLeft />
            {battle.leagueName}
          </Link>
        </Button>

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

        <p className="mt-2 text-sm text-muted-foreground">{format.rule}</p>
      </div>

      <Scoreboard>
        <Score
          label="Your money"
          value={formatMoney(you?.totalValue ?? battle.startingBalance)}
          hint={`Started with ${formatMoney(battle.startingBalance)}`}
        />
        <Score
          label="This battle"
          value={formatPercent(you?.returnPercent ?? 0)}
          tone={(you?.returnPercent ?? 0) >= 0 ? "gain" : "loss"}
          hint={`${battle.length.name}, ending ${battle.endsOn}`}
        />
        <Score
          label={format.benchmark}
          value={
            benchmarkReturnPercent == null
              ? "Not yet"
              : formatPercent(benchmarkReturnPercent)
          }
          as={benchmarkReturnPercent == null ? "text" : "figure"}
          tone={
            benchmarkReturnPercent == null
              ? "neutral"
              : benchmarkReturnPercent >= 0
                ? "gain"
                : "loss"
          }
          hint="What this battle is measured against"
        />
        <Score label="Cash left" value={formatMoney(view.cash)} hint="Cash earns nothing" />
      </Scoreboard>

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

      <Well className="py-3">
        <p className="text-sm text-muted-foreground">
          A battle changes nothing about the ordinary week. Your streak, your
          record and the season are the week everybody plays, and they carry on
          while this runs. <Link href="/how" className="underline">How Arena works</Link>.
        </p>
      </Well>
    </div>
  );
}
