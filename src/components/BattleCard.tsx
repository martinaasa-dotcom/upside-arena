import Link from "next/link";
import { ArrowRight, Swords } from "lucide-react";
import { Panel, Well } from "@/components/Panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate, formatPercent } from "@/lib/format";
import type { Battle } from "@/lib/game/battles";
import { SETTING_ACTIONS, SETTING_COPY, SETTING_ROW, SettingBar } from "@/components/ui/setting-row";

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

        A battle made at the weekend has not started yet, and this badge was
        showing it a countdown in the colour that means running. So on a
        Saturday it read as live, and somebody tapping through found the
        trade form shut with an explanation -- the card had told them one
        thing and the room another.

        It says the day it begins instead, in the quiet variant, which is
        also the honest answer to the only question the badge is there to
        settle: can I do something about this now.
      */}
      <SettingBar
        className="mb-4"
        action={
          <Badge
            variant={battle.finished || battle.notStarted ? "outline" : "gain"}
          >
            {battle.finished
              ? "Finished"
              : battle.notStarted
                ? `Starts ${formatDate(battle.startsOn)}`
                : battle.timeLeft}
          </Badge>
        }
        description={battle.format.rule}
      >
        <h2 className="flex min-w-0 items-center gap-2 truncate text-lg font-semibold tracking-tight">
          <span aria-hidden="true">{battle.format.icon}</span>
          <span className="truncate">{battle.format.name}</span>
        </h2>
      </SettingBar>

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
          {battle.cadence.id !== "always" ? (
            <span className="text-sm text-muted-foreground">{battle.cadence.rule}</span>
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

        <div className={SETTING_ROW}>
          <div className={SETTING_COPY} />
          <div className={SETTING_ACTIONS}>
            <Button asChild size="sm">
              <Link href={href}>
                <Swords className="size-4" aria-hidden="true" />
                {battle.finished ? "See how it ended" : "Open the battle"}
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </Panel>
  );
}
