import Link from "next/link";
import { ArrowRight, Swords } from "lucide-react";
import { Panel, Well } from "@/components/Panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatPercent } from "@/lib/format";
import type { Battle } from "@/lib/game/battles";

/*
  A battle, summarised wherever it is not the thing on screen: on the league
  page, and on Home when one is running.

  It says the two things somebody needs to decide whether to open it -- what
  the rules are and how long is left -- and nothing else. A standing here
  would be a second, staler copy of the one inside.
*/
export function BattleCard({
  battle,
  href,
  result,
}: {
  battle: Battle;
  href: string;
  /** Where they finished, once it is settled. */
  result?: { rank: number; players: number; returnPercent: number } | null;
}) {
  return (
    <Panel>
      {/*
        Its own header rather than the Panel's, because the format's icon
        belongs beside its name and Panel takes a plain string title.
      */}
      <header className="mb-4 flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            <span aria-hidden="true">{battle.format.icon}</span>
            {battle.format.name}
          </h2>
          <p className="text-sm text-muted-foreground">{battle.format.rule}</p>
        </div>
        <Badge variant={battle.finished ? "outline" : "gain"} className="shrink-0">
          {battle.finished ? "Finished" : battle.timeLeft}
        </Badge>
      </header>

      <div className="flex flex-col gap-3">
        <Well className="flex flex-wrap items-center gap-x-6 gap-y-1 py-3">
          <span className="text-sm text-muted-foreground">
            {battle.length.name} in {battle.leagueName}
          </span>
          <span className="text-sm text-muted-foreground">
            Measured against{" "}
            <span className="figure text-foreground">{battle.benchmarkSymbol}</span>
          </span>
          {battle.format.tradingHours === "always" ? (
            <span className="text-sm text-primary">Runs through the weekend</span>
          ) : null}
        </Well>

        {result ? (
          <p className="text-sm">
            You finished{" "}
            <span className="figure font-semibold">
              {result.rank} of {result.players}
            </span>
            , at{" "}
            <span
              className={result.returnPercent >= 0 ? "figure text-gain" : "figure text-loss"}
            >
              {formatPercent(result.returnPercent)}
            </span>
            .
          </p>
        ) : null}

        <div>
          <Button asChild>
            <Link href={href}>
              <Swords className="size-4" aria-hidden="true" />
              {battle.finished ? "See how it ended" : "Open the battle"}
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </div>
    </Panel>
  );
}
