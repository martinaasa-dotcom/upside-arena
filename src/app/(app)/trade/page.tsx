import Link from "next/link";
import { redirect } from "next/navigation";
import { Panel, Well } from "@/components/Panel";
import { TradeForm } from "@/components/TradeForm";
import { Lineup } from "@/components/Lineup";
import { getSession } from "@/lib/profile";
import { getPortfolioView } from "@/lib/game/portfolio";
import { getLineup } from "@/lib/game/lineup";
import { getLiveBattles } from "@/lib/game/battles";
import { BattleCard } from "@/components/BattleCard";
import { PAGE, STACK } from "@/lib/page-shell";
import { TrackView } from "@/components/TrackView";
import { formatMoney } from "@/lib/format";
import { isWeekend, lineupMonday } from "@/lib/market/session";

export const metadata = { title: "Trade" };

/*
  One room, two jobs, decided by the clock.

  While the market is open this is the trade screen. From Friday's close to
  Monday's bell there is nothing to trade, and it becomes the place you say
  what you want to own when it opens again -- which is the same intention, in
  the same room, at the only moment somebody can act on it.

  It is not a second screen behind a second tab, because a tab called "Lineup"
  that does nothing five days a week is a tab people learn to ignore.
*/
export default async function TradePage() {
  const { user } = await getSession();
  if (!user) redirect("/");

  const view = await getPortfolioView(user.id);

  if (!view) {
    return (
      <div className={`${PAGE} ${STACK}`}>
        <TrackView event="trade_screen_viewed" />
        <h1>Trade</h1>
        <Panel
          title="Trading is not switched on yet"
          description="The game engine needs its server key before trades can be placed. Nothing you do here is lost in the meantime."
        />
      </div>
    );
  }

  const weekend = isWeekend();

  /*
    A battle whose market never shuts is the one thing that is still playable
    on a Saturday, so it is offered here rather than left to be found.
  */
  const battles = await getLiveBattles(user.id);
  const openNow = battles.filter(
    (battle) => battle.format.tradingHours === "always" && !battle.notStarted
  );

  if (weekend) {
    const monday = lineupMonday();
    const lineup = await getLineup(user.id, monday, view.startingBalance);

    return (
      <div className={`${PAGE} ${STACK}`}>
        <TrackView event="trade_screen_viewed" />

        <div className="flex items-baseline justify-between gap-4">
          <h1>The weekend</h1>
          <span className="figure text-sm text-muted-foreground">
            Market shut until Monday
          </span>
        </div>

        <Well className="py-3">
          <p className="text-sm text-muted-foreground">
            Nothing moves until Monday at 09:30 New York time, so there is
            nothing to trade and nothing to miss. What you can do is decide now.
          </p>
        </Well>

        <Lineup view={lineup} />

        {openNow.map((battle) => (
          <BattleCard
            key={battle.cycleId}
            battle={battle}
            href={`/leagues/${battle.leagueId}/battle`}
          />
        ))}

        <Well className="py-3">
          <p className="text-sm text-muted-foreground">
            Not sure what any of this is?{" "}
            <Link href="/how" className="underline">
              How Arena works
            </Link>{" "}
            is two minutes.
          </p>
        </Well>
      </div>
    );
  }

  const closedReason =
    "The market is closed right now. Trading runs from 09:30 to 16:00 New York time.";

  return (
    <div className={`${PAGE} ${STACK}`}>
      <TrackView event="trade_screen_viewed" />

      <div className="flex items-baseline justify-between gap-4">
        <h1>Trade</h1>
        <span className="figure text-sm text-muted-foreground">
          {formatMoney(view.cash)} cash
        </span>
      </div>

      <Panel>
        <TradeForm
          cash={view.cash}
          ownedSymbols={view.positions.map((p) => p.symbol)}
          tradingOpen={view.tradingOpen}
          closedReason={closedReason}
        />
      </Panel>

      {openNow.map((battle) => (
        <BattleCard
          key={battle.cycleId}
          battle={battle}
          href={`/leagues/${battle.leagueId}/battle`}
        />
      ))}
    </div>
  );
}
