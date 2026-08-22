import { Suspense } from "react";
import Link from "next/link";
import { Panel } from "@/components/Panel";
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
import { hasDeclaredGoalThisWeek } from "@/lib/game/goals";
import { getLatestLineupReport } from "@/lib/game/lineup";
import { BattleCard } from "@/components/BattleCard";
import { LineupReport } from "@/components/Lineup";
import { considerHandoff, labUrl } from "@/lib/billing/handoff";
import { plural } from "@/lib/format";
import { COLUMN, PAGE, SPLIT, STACK } from "@/lib/page-shell";
import { formatGap, formatMoney, formatPercent } from "@/lib/format";
import { sessionLabel } from "@/lib/market/session";

export const metadata = { title: "Home" };

/*
  Home paints before it knows anything.

  It used to await a session, a priced portfolio, a streak write, the leagues,
  last week's recap and the Lab check -- all of it -- before returning a single
  element. Nothing could be prerendered, so the whole room was a grey skeleton
  for as long as the slowest of those took, which on a cold function meant the
  upstream price fetch.

  So the page itself is synchronous now. What it returns is the room: the
  heading, the four labels on the scoreboard, the panel that holds what you
  own. That much is prerendered and is on screen in the same frame as the tap.
  Every figure inside it arrives on its own, and until it does the cell shows a
  dash in the right place rather than a moving grey bar.

  The labels are the point. "Your money" and "Cash left" are true before the
  numbers land, and a room whose words are already there does not read as
  loading even while a figure is still on its way.
*/
export default function HomePage() {
  return (
    <div className={`${PAGE} ${STACK}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/*
          "Hi" is prerendered and the name arrives after it. Putting the whole
          greeting behind the boundary let the prerender bake "Hi there", which
          a signed-in player would have watched turn into their own name.
        */}
        <h1>
          Hi{" "}
          <Suspense fallback={null}>
            <PlayerName />
          </Suspense>
        </h1>
        <div className="flex items-center gap-2">
          <Suspense fallback={null}>
            <MarketBadges />
          </Suspense>
          <Badge variant="outline">Play money</Badge>
        </div>
      </div>

      {/*
        Status has to resolve in about two seconds: what it is worth, whether
        that is up or down, and whether it is beating the market. The labels
        are here rather than inside the fallback so they are prerendered once
        and never replaced.
      */}
      <Scoreboard>
        <Suspense fallback={<Score label="Your money" value="—" as="text" />}>
          <MoneyScore />
        </Suspense>
        <Suspense fallback={<Score label="This week" value="—" as="text" />}>
          <WeekScore />
        </Suspense>
        <Suspense
          fallback={
            <Score
              label="The market"
              value="—"
              as="text"
              hint="Everyone is measured against this"
            />
          }
        >
          <MarketScore />
        </Suspense>
        <Suspense
          fallback={<Score label="Cash left" value="—" as="text" hint="Cash earns nothing" />}
        >
          <CashScore />
        </Suspense>
      </Scoreboard>

      <Suspense fallback={null}>
        <Rest />
      </Suspense>
    </div>
  );
}

async function PlayerName() {
  const { profile } = await getSession();
  return <>{profile?.display_name ?? "there"}</>;
}

async function MarketBadges() {
  const { user } = await getSession();
  const view = user ? await getPortfolioView(user.id) : null;
  if (!view) return null;

  return (
    <>
      {view.anyStale ? <Badge variant="warning">Prices are catching up</Badge> : null}
      <Badge variant="outline">{sessionLabel(view.marketState)}</Badge>
    </>
  );
}

/** The four figures, each on its own so one slow answer holds up nothing. */
async function homeView() {
  const { user } = await getSession();
  return user ? getPortfolioView(user.id) : null;
}

async function MoneyScore() {
  const view = await homeView();
  if (!view) return <Score label="Your money" value="—" as="text" />;
  return (
    <Score
      label="Your money"
      value={<Ticker value={view.totalValue} format="money" />}
      hint={`Started with ${formatMoney(view.startingBalance)}`}
    />
  );
}

async function WeekScore() {
  const view = await homeView();
  if (!view) return <Score label="This week" value="—" as="text" />;

  const up = view.returnPercent >= 0;

  return (
    <Score
      label="This week"
      value={<Ticker value={view.returnPercent} format="percent" />}
      tone={up ? "gain" : "loss"}
      hint={`${up ? "Up" : "Down"} ${formatMoney(
        Math.abs(view.totalValue - view.startingBalance)
      )}`}
    />
  );
}

async function MarketScore() {
  const view = await homeView();
  const pct = view?.benchmarkReturnPercent ?? null;
  return (
    <Score
      label="The market"
      value={pct == null ? "Not yet" : formatPercent(pct)}
      as={pct == null ? "text" : "figure"}
      tone={pct == null ? "neutral" : pct >= 0 ? "gain" : "loss"}
      hint="Everyone is measured against this"
    />
  );
}

async function CashScore() {
  const view = await homeView();
  return (
    <Score
      label="Cash left"
      value={view ? formatMoney(view.cash) : "—"}
      as={view ? "figure" : "text"}
      hint="Cash earns nothing"
    />
  );
}

/*
  Everything below the scoreboard, which is one region because it is one
  scroll: the market line, the streak, what you own. It streams as a piece
  rather than flickering in six.
*/
async function Rest() {
  const { user, profile } = await getSession();

  /*
    Opening Home and looking at your portfolio is what a streak counts, which
    is the trigger the plan says to start with. Crediting it here and nowhere
    else keeps the streak meaning the one thing it claims to mean.
  */
  const [
    view,
    activity,
    leagues,
    lastWeek,
    handoff,
    battles,
    playedBattle,
    declaredGoal,
    lineupReport,
  ] = user
    ? await Promise.all([
        getPortfolioView(user.id),
        recordVisit(user.id),
        getLeagues(user.id),
        getLatestRecap(user.id),
        // Almost always null. Only for somebody it is actually true of, and
        // twice at most in their whole time here.
        considerHandoff(user.id),
        /*
          The four below could have waited for the portfolio view, since two of
          them are about the week it names. They resolve the week themselves
          instead, through the same memoised getCurrentCycle the view uses, so
          they go out in this wave rather than in a second one stacked on the
          end of a region that was otherwise ready.
        */
        getLiveBattles(user.id),
        hasEverPlayedBattle(user.id),
        hasDeclaredGoalThisWeek(user.id),
        getLatestLineupReport(user.id),
      ])
    : [null, null, [], null, null, [], false, false, null];

  /*
    With no engine configured there is nothing true to show, so the screen says
    so rather than inventing a portfolio value. A placeholder number here would
    teach players to distrust every number in the game.

    `!user` is folded into the same check rather than made separately. A
    portfolio view only exists for a signed-in player, so the two are one
    condition, and saying so lets everything below read `user.id` rather than
    insisting to the type checker that it is there.
  */
  if (!view || !user) {
    return (
      <Panel
        title="Your first week has not started yet"
        description="Trading opens once the game engine is switched on."
      />
    );
  }


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
    <>
      {activity ? <EarnedToast earned={activity.earned} /> : null}
      {activity ? <BonusToast bonuses={activity.bonuses} /> : null}

      {/*
        How the week is going on the left, what to do about it on the right.

        The left column is the wider of the two and holds what somebody opened
        the app to see: whether they are beating the market, their streak, and
        what they own. The right holds what they might do next, which is where
        a first-week list, a battle and last week's card belong.

        One column under lg, in this order, which is the order they were in
        when there was only one.
      */}
      <div className={SPLIT}>
        <div className={COLUMN}>
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

        <div className={COLUMN}>
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
        </div>
      </div>
    </>
  );
}
