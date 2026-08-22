import { redirect } from "next/navigation";
import { Panel } from "@/components/Panel";
import { TradeForm } from "@/components/TradeForm";
import { getSession } from "@/lib/profile";
import { getPortfolioView } from "@/lib/game/portfolio";
import { PAGE, STACK } from "@/lib/page-shell";
import { TrackView } from "@/components/TrackView";
import { formatMoney } from "@/lib/format";
import { isWeekend } from "@/lib/market/session";

export const metadata = { title: "Trade" };


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

  const closedReason = isWeekend()
    ? "The market is closed for the weekend. Trading opens again on Monday at 09:30 New York time."
    : "The market is closed right now. Trading runs from 09:30 to 16:00 New York time.";

  return (
    <div className={`${PAGE} ${STACK}`}>
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
    </div>
  );
}
