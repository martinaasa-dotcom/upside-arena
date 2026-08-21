import { Flame, Users } from "lucide-react";
import { Panel, Well } from "@/components/Panel";
import { Score, Scoreboard } from "@/components/Scoreboard";
import { Badge } from "@/components/ui/badge";
import { getSession } from "@/lib/profile";
import { PAGE, STACK } from "@/lib/page-shell";

export const metadata = { title: "Home" };

export default async function HomePage() {
  const { profile } = await getSession();
  const name = profile?.display_name ?? "there";

  return (
    <div className={`${PAGE} ${STACK}`}>
      <div className="flex items-center justify-between gap-4">
        <h1>Hi {name}</h1>
        <Badge variant="outline">Play money</Badge>
      </div>

      {/*
        Lifetime stats only. Weekly portfolio numbers arrive with the trading
        engine, and showing a fake one here would teach players to distrust
        every number in the app.
      */}
      <Scoreboard>
        <Score label="Weeks played" value={profile?.weeks_played ?? 0} />
        <Score
          label="Best week"
          value={
            profile?.best_week_return != null
              ? `${profile.best_week_return > 0 ? "+" : ""}${Number(
                  profile.best_week_return
                ).toFixed(1)}%`
              : "Not yet"
          }
          as={profile?.best_week_return != null ? "figure" : "text"}
          tone={
            profile?.best_week_return != null && profile.best_week_return > 0
              ? "gain"
              : "neutral"
          }
        />
        <Score label="Longest streak" value={profile?.longest_streak ?? 0} hint="days" />
        <Score label="Leagues" value={0} />
      </Scoreboard>

      <Panel
        title="Your first week has not started yet"
        description="Trading opens when the portfolio engine lands. Here is what happens then."
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
