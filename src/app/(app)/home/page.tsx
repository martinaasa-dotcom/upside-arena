import Link from "next/link";
import { Flame, Users } from "lucide-react";
import { Panel, Well } from "@/components/Panel";
import { Score, Scoreboard } from "@/components/Scoreboard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Holdings } from "@/components/Holdings";
import { getSession } from "@/lib/profile";
import { getPortfolioView } from "@/lib/game/portfolio";
import { PAGE, STACK } from "@/lib/page-shell";
import { formatMoney, formatPercent } from "@/lib/format";
import { sessionLabel } from "@/lib/market/session";

export const metadata = { title: "Home" };

// Prices move, so this page is never served from a cache.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const { user, profile } = await getSession();
  const name = profile?.display_name ?? "there";
  const view = user ? await getPortfolioView(user.id) : null;

  /*
    With no engine configured there is nothing true to show, so the screen says
    so rather than inventing a portfolio value. A placeholder number here would
    teach players to distrust every number in the game.
  */
  if (!view) {
    return (
      <div className={`${PAGE} ${STACK}`}>
        <div className="flex items-center justify-between gap-4">
          <h1>Hi {name}</h1>
          <Badge variant="outline">Play money</Badge>
        </div>

        <Scoreboard>
          <Score label="Weeks played" value={profile?.weeks_played ?? 0} />
          <Score label="Best week" value="Not yet" as="text" />
          <Score label="Longest streak" value={profile?.longest_streak ?? 0} hint="days" />
          <Score label="Leagues" value={0} />
        </Scoreboard>

        <Panel
          title="Your first week has not started yet"
          description="Trading opens once the game engine is switched on."
        >
          <div className="flex flex-col gap-3">
            <Well className="flex items-start gap-3">
              <Users className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
              <p className="text-sm text-muted-foreground">
                Every Monday you and everyone in your league start with the same
                pretend money. On Friday you find out who did best.
              </p>
            </Well>
            <Well className="flex items-start gap-3">
              <Flame className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
              <p className="text-sm text-muted-foreground">
                Open the app once a day to keep your streak going. Missing a day
                never costs you your place in the league.
              </p>
            </Well>
          </div>
        </Panel>
      </div>
    );
  }

  const up = view.returnPercent >= 0;

  return (
    <div className={`${PAGE} ${STACK}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1>Hi {name}</h1>
        <div className="flex items-center gap-2">
          {view.anyStale ? (
            <Badge variant="warning">Prices are catching up</Badge>
          ) : null}
          <Badge variant="outline">{sessionLabel(view.marketState)}</Badge>
          <Badge variant="outline">Play money</Badge>
        </div>
      </div>

      {/*
        Status has to resolve in about two seconds: what it is worth, whether
        that is up or down, and whether it is beating the market.
      */}
      <Scoreboard>
        <Score
          label="Your money"
          value={formatMoney(view.totalValue)}
          hint={`Started with ${formatMoney(view.startingBalance)}`}
        />
        <Score
          label="This week"
          value={formatPercent(view.returnPercent)}
          tone={up ? "gain" : "loss"}
          hint={`${up ? "Up" : "Down"} ${formatMoney(
            Math.abs(view.totalValue - view.startingBalance)
          )}`}
        />
        <Score
          label="The market"
          value={
            view.benchmarkReturnPercent == null
              ? "Not yet"
              : formatPercent(view.benchmarkReturnPercent)
          }
          as={view.benchmarkReturnPercent == null ? "text" : "figure"}
          tone={
            view.benchmarkReturnPercent == null
              ? "neutral"
              : view.benchmarkReturnPercent >= 0
                ? "gain"
                : "loss"
          }
          hint="Everyone is measured against this"
        />
        <Score
          label="Cash left"
          value={formatMoney(view.cash)}
          hint="Cash earns nothing"
        />
      </Scoreboard>

      {view.versusMarket != null ? (
        <Panel>
          <p className="text-sm">
            {view.versusMarket >= 0 ? (
              <>
                You are <span className="figure text-gain">
                  {formatPercent(view.versusMarket)}
                </span>{" "}
                ahead of the market this week.
              </>
            ) : (
              <>
                You are <span className="figure text-loss">
                  {formatPercent(Math.abs(view.versusMarket) * -1)}
                </span>{" "}
                behind the market this week.
              </>
            )}{" "}
            <span className="text-muted-foreground">
              Beating a falling market still counts as a good week.
            </span>
          </p>
        </Panel>
      ) : null}

      <Panel
        title="What you own"
        description={
          view.positions.length === 0
            ? "Nothing yet. Your money is all sitting in cash, which earns nothing."
            : undefined
        }
        action={
          <Button asChild size="sm">
            <Link href="/trade">
              {view.positions.length === 0 ? "Make your first trade" : "Trade"}
            </Link>
          </Button>
        }
      >
        {view.positions.length > 0 ? <Holdings positions={view.positions} /> : null}
      </Panel>
    </div>
  );
}
