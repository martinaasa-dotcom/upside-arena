import Link from "next/link";
import { Flame, Users } from "lucide-react";
import { Panel, Well } from "@/components/Panel";
import { Score, Scoreboard } from "@/components/Scoreboard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Holdings } from "@/components/Holdings";
import { StreakCard } from "@/components/StreakCard";
import { EarnedToast } from "@/components/EarnedToast";
import { BonusToast } from "@/components/BonusToast";
import { NotificationInvite } from "@/components/NotificationInvite";
import { FirstRun } from "@/components/FirstRun";
import { Ticker } from "@/components/Ticker";
import { WeekRecap } from "@/components/WeekRecap";
import { TrackView } from "@/components/TrackView";
import { LabHandoff } from "@/components/LabHandoff";
import { getSession } from "@/lib/profile";
import { getPortfolioView } from "@/lib/game/portfolio";
import { recordVisit } from "@/lib/game/streaks";
import { getLeagues } from "@/lib/game/leagues";
import { getLatestRecap } from "@/lib/game/share";
import { getLiveBattles, hasEverPlayedBattle } from "@/lib/game/battles";
import { hasDeclaredGoal } from "@/lib/game/goals";
import { getLineupReport } from "@/lib/game/lineup";
import { BattleCard } from "@/components/BattleCard";
import { LineupReport } from "@/components/Lineup";
import { considerHandoff, labUrl } from "@/lib/billing/handoff";
import { plural } from "@/lib/format";
import { PAGE, STACK } from "@/lib/page-shell";
import { formatGap, formatMoney, formatPercent } from "@/lib/format";
import { sessionLabel } from "@/lib/market/session";

export const metadata = { title: "Home" };


export default async function HomePage() {
  const { user, profile } = await getSession();
  const name = profile?.display_name ?? "there";

  /*
    Opening Home and looking at your portfolio is what a streak counts, which
    is the trigger the plan says to start with. Crediting it here and nowhere
    else keeps the streak meaning the one thing it claims to mean.
  */
  const [view, activity, leagues, lastWeek, handoff] = user
    ? await Promise.all([
        getPortfolioView(user.id),
        recordVisit(user.id),
        getLeagues(user.id),
        getLatestRecap(user.id),
        // Almost always null. Only for somebody it is actually true of, and
        // twice at most in their whole time here.
        considerHandoff(user.id),
      ])
    : [null, null, [], null, null];

  /*
    With no engine configured there is nothing true to show, so the screen says
    so rather than inventing a portfolio value. A placeholder number here would
    teach players to distrust every number in the game.
  */
  /*
    `!user` is folded in here rather than checked separately. A portfolio view
    only exists for a signed-in player, so the two are the same condition;
    saying so lets everything below read `user.id` rather than insisting to
    the type checker that it is there.
  */
  if (!view || !user) {
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
          <Score label="Leagues" value={leagues.length} />
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

  /*
    The rest of the week, asked for together.

    Every one of these is a small indexed read that depends on nothing above
    it, and they were the difference between one round trip and five stacked
    on the end of a screen that was otherwise ready.
  */
  const [battles, playedBattle, declaredGoal, lineupReport] = await Promise.all([
    getLiveBattles(user.id),
    hasEverPlayedBattle(user.id),
    hasDeclaredGoal(user.id, view.cycle.id),
    getLineupReport(user.id, view.cycle.monday),
  ]);

  /*
    Somebody who has never traded is still being told what this is. It goes
    the moment they do, because an explainer that outlives its usefulness is
    an advert for something they already have.
  */
  const brandNew = view.positions.length === 0 && view.cash === view.startingBalance;
  const starter = leagues[0] ?? null;

  /*
    Whether there is anything worth asking to interrupt them for, said in the
    words of the thing itself. With nobody to be passed by and nothing owned,
    the honest answer is that there is not, and nothing is asked.
  */
  const rival = leagues.find((league) => league.memberCount > 1);

  // Their first fortnight, roughly. See the panel below for why it is bounded.
  const showFirstWeek = (profile?.weeks_played ?? 0) <= 1;
  const inviteReason = rival
    ? `Want to know when somebody in ${rival.name} passes you?`
    : activity && activity.streak.current >= 2
      ? `You are ${plural(activity.streak.current, "day")} into a streak. Want a nudge on a day you have not opened Arena?`
      : "";
  const inviteKind = rival ? "rival" : "streak";

  return (
    <div className={`${PAGE} ${STACK}`}>
      {activity ? <EarnedToast earned={activity.earned} /> : null}
      {activity ? <BonusToast bonuses={activity.bonuses} /> : null}

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
          value={<Ticker value={view.totalValue} format="money" />}
          hint={`Started with ${formatMoney(view.startingBalance)}`}
        />
        <Score
          label="This week"
          value={<Ticker value={view.returnPercent} format="percent" />}
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
                You are{" "}
                <span className="figure text-gain">
                  {formatGap(view.versusMarket)}
                </span>{" "}
                ahead of the market this week.
              </>
            ) : (
              <>
                You are{" "}
                <span className="figure text-loss">
                  {formatGap(view.versusMarket)}
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

      {inviteReason ? (
        <NotificationInvite
          reason={inviteReason}
          kind={inviteKind}
          publicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ""}
        />
      ) : null}

      {activity ? (
        <>
          <TrackView
            event="streak_viewed"
            properties={{ counted: activity.streak.countedToday }}
          />
          <StreakCard streak={activity.streak} />
        </>
      ) : null}

      {/*
        The first week's list, while it is still their first week.

        Bounded by weeks played rather than left to run until the last box is
        ticked. A player two months in who has never declared a goal has not
        failed to finish anything -- they have decided they do not want that
        part -- and a panel telling them so every Monday would be nagging.
      */}
      {showFirstWeek ? (
        <FirstRun
          startingBalance={view.startingBalance}
          leagueName={starter?.name ?? null}
          inviteCode={starter?.inviteCode ?? null}
          leagueHref={starter ? `/leagues/${starter.id}` : "/leagues"}
          hasTraded={!brandNew}
          hasCompany={Boolean(rival)}
          hasGoal={declaredGoal}
          hasBattle={playedBattle}
        />
      ) : null}

      {/* What a lineup did this week, said once and then not again. */}
      {lineupReport ? (
        <LineupReport
          filled={lineupReport.filled}
          missed={lineupReport.missed.map((order) => ({
            symbol: order.symbol,
            detail: order.detail,
          }))}
        />
      ) : null}

      {battles.map((battle) => (
        <BattleCard
          key={battle.cycleId}
          battle={battle}
          href={`/leagues/${battle.leagueId}/battle`}
        />
      ))}

      {handoff ? (
        <>
          <TrackView event="lab_handoff_shown" />
          <LabHandoff
            token={handoff.token}
            weeksPlayed={handoff.weeksPlayed}
            weeksAhead={handoff.weeksAhead}
            url={labUrl(handoff.token)}
          />
        </>
      ) : null}

      {lastWeek ? (
        <>
          {/*
            Shares are measured against recaps seen, not against players. A
            player with no finished week has not declined to share one.
          */}
          <TrackView event="week_recap_viewed" />
          <WeekRecap recap={lastWeek.recap} />
        </>
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
