import { Suspense } from "react";
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

/*
  The heading and the panel are the room, and neither needs to know anything,
  so both are prerendered and arrive with the tap. What is priced -- the cash
  line and the form's own limits -- streams into them.
*/
export default function TradePage() {
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

      <Panel>
        <Suspense fallback={<FormPending />}>
          <Form />
        </Suspense>
      </Panel>
    </div>
  );
}

async function CashLine() {
  const { user } = await getSession();
  if (!user) return null;

  const view = await getPortfolioView(user.id);
  return view ? <>{formatMoney(view.cash)} cash</> : null;
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

async function Form() {
  const { user } = await getSession();
  if (!user) redirect("/");

  const view = await getPortfolioView(user.id);

  if (!view) {
    return (
      <p className="text-sm text-muted-foreground">
        Trading is not switched on yet. The game engine needs its server key
        before trades can be placed, and nothing you do here is lost meanwhile.
      </p>
    );
  }

  const closedReason = isWeekend()
    ? "The market is closed for the weekend. Trading opens again on Monday at 09:30 New York time."
    : "The market is closed right now. Trading runs from 09:30 to 16:00 New York time.";

  return (
    <TradeForm
      cash={view.cash}
      ownedSymbols={view.positions.map((p) => p.symbol)}
      tradingOpen={view.tradingOpen}
      closedReason={closedReason}
    />
  );
}
