import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Panel, Well } from "@/components/Panel";
import { TradeForm } from "@/components/TradeForm";
import { Lineup } from "@/components/Lineup";
import { BattleCard } from "@/components/BattleCard";
import { getSession } from "@/lib/profile";
import { getPortfolioView } from "@/lib/game/portfolio";
import { getLineup } from "@/lib/game/lineup";
import { getLiveBattles } from "@/lib/game/battles";
import { PAGE, STACK } from "@/lib/page-shell";
import { TrackView } from "@/components/TrackView";
import { formatMoney } from "@/lib/format";
import { isLineupWindow, isWeekend, lineupMonday } from "@/lib/market/session";

export const metadata = { title: "Trade" };

/*
  The heading and the panel are the room, and neither needs to know anything,
  so both are prerendered and arrive with the tap. What is priced -- the cash
  line and the form's own limits -- streams into them.

  One room, two jobs. While the market is open this is the trade screen; from
  Friday's close to Monday's bell there is nothing to trade, and it becomes the
  place you say what you want to own when it opens again. Deliberately not a
  second tab: one called "Lineup" that does nothing five days a week is a tab
  people learn to ignore.

  Which of the two it is cannot be decided up here. This component is
  prerendered, so a clock read inside it would be the clock at build time and
  the room would arrive insisting it was a Tuesday. The choice belongs inside
  the boundary, where the render is actually happening.
*/
type Search = Promise<{ symbol?: string }>;

/** A ticker handed over in a link, kept only if it could be one. */
function pickedFrom(symbol: string | undefined): string | null {
  if (!symbol) return null;
  const clean = symbol.trim().toUpperCase();
  /*
    Shaped like a symbol or dropped. It is put straight into a form field that
    is posted back, and the server checks it again before anything is bought --
    but a screen should not render whatever a url felt like saying either.
  */
  return /^[A-Z0-9.\-]{1,12}$/.test(clean) ? clean : null;
}

export default function TradePage({ searchParams }: { searchParams: Search }) {
  return (
    <div className={`${PAGE} ${STACK}`}>
      <TrackView event="trade_screen_viewed" />

      <div className="flex items-baseline justify-between gap-4">
        <h1>Trade</h1>
        <span className="figure text-sm text-muted-foreground">
          <Suspense fallback={null}>
            <CashLine />
          </Suspense>
        </span>
      </div>

      <Suspense
        fallback={
          <Panel>
            <FormPending />
          </Panel>
        }
      >
        <Body searchParams={searchParams} />
      </Suspense>

      {/*
        A battle whose market never shuts is the one thing still playable on a
        Saturday, so it is offered here rather than left to be found. Its own
        boundary, because it is several leagues' worth of reads and must not
        hold up the form.
      */}
      <Suspense fallback={null}>
        <AllHoursBattles />
      </Suspense>
    </div>
  );
}

async function CashLine() {
  const { user } = await getSession();
  if (!user) return null;

  const view = await getPortfolioView(user.id);
  if (!view) return null;

  /*
    Before the week starts the figure is the money it starts with, and calling
    that "cash" would be true of a balance nobody can spend yet.
  */
  return isLineupWindow() ? (
    <>{formatMoney(view.startingBalance)} on Monday</>
  ) : (
    <>{formatMoney(view.cash)} cash</>
  );
}

/*
  The form's shape while its numbers are on the way. Same height as the real
  one, so the panel does not resize under somebody's thumb once it lands.
*/
function FormPending() {
  return (
    <div className="flex min-h-64 flex-col gap-4" aria-busy="true">
      <span className="sr-only">Loading the trade form</span>
    </div>
  );
}

async function Body({ searchParams }: { searchParams: Search }) {
  const { user } = await getSession();
  if (!user) redirect("/");

  const view = await getPortfolioView(user.id);

  if (!view) {
    return (
      <Panel>
        <p className="text-sm text-muted-foreground">
          Trading is not switched on yet. The game engine needs its server key
          before trades can be placed, and nothing you do here is lost meanwhile.
        </p>
      </Panel>
    );
  }

  /*
    The lineup, all weekend and on the Monday itself until the bell.

    It used to be the weekend only, which quietly broke the promise the panel
    makes: it says a lineup can be changed until the bell on Monday, and
    somebody opening Arena at eight on a Monday morning could neither trade nor
    see the thing that was about to spend their money.
  */
  if (isLineupWindow()) {
    const lineup = await getLineup(user.id, lineupMonday(), view.startingBalance);

    return (
      <>
        <Well className="py-3">
          <p className="text-sm text-muted-foreground">
            {isWeekend()
              ? "The market is shut until Monday at 09:30 New York time, so there is nothing to trade and nothing to miss. What you can do is decide now."
              : "The market opens at 09:30 New York time this morning. Nothing can be traded until it does, and this is the last chance to change what is bought at the open."}
          </p>
        </Well>

        <Lineup view={lineup} />

        <Well className="py-3">
          <p className="text-sm text-muted-foreground">
            Not sure what any of this is?{" "}
            <Link href="/how" className="underline">
              How Arena works
            </Link>{" "}
            is two minutes.
          </p>
        </Well>
      </>
    );
  }

  const closedReason =
    "The market is closed right now. Trading runs from 09:30 to 16:00 New York time.";

  return (
    <Panel>
      <TradeForm
        cash={view.cash}
        ownedSymbols={view.positions.map((p) => p.symbol)}
        tradingOpen={view.tradingOpen}
        closedReason={closedReason}
        initialSymbol={pickedFrom((await searchParams).symbol)}
      />
    </Panel>
  );
}

async function AllHoursBattles() {
  const { user } = await getSession();
  if (!user) return null;

  const battles = await getLiveBattles(user.id);

  return (
    <>
      {battles
        .filter(
          (battle) => battle.format.tradingHours === "always" && !battle.notStarted
        )
        .map((battle) => (
          <BattleCard
            key={battle.cycleId}
            battle={battle}
            href={`/leagues/${battle.leagueId}/battle`}
          />
        ))}
    </>
  );
}
