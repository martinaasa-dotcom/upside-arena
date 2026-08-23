import { Suspense } from "react";
import { connection } from "next/server";
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
import { readStreak, recordVisit } from "@/lib/game/streaks";
import { getLeagues } from "@/lib/game/leagues";
import { getLatestRecap } from "@/lib/game/share";
import { getLiveBattles, hasEverPlayedBattle } from "@/lib/game/battles";
import { hasDeclaredGoalThisWeek } from "@/lib/game/goals";
import { getLatestLineupReport } from "@/lib/game/lineup";
import { getMovers } from "@/lib/market/movers";
import { getDailyMarks } from "@/lib/game/marks";
import { dayMove, lastCloseBefore, weekSoFar, worthDrawing } from "@/lib/game/shape";
import { Movers } from "@/components/Movers";
import { WeekShape } from "@/components/WeekShape";
import { BattleCard } from "@/components/BattleCard";
import { LineupReport } from "@/components/Lineup";
import { considerHandoff, labUrl } from "@/lib/billing/handoff";
import { plural } from "@/lib/format";
import { COLUMN, PAGE, SPLIT, STACK } from "@/lib/page-shell";
import { formatGap, formatMoney, formatPercent } from "@/lib/format";
import { sessionLabel } from "@/lib/market/session";
import { marketHasOpened, today as todayInNewYork } from "@/lib/market/clock";

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
/*
  Counting the visit, which is the only thing on this screen that writes.

  Deliberately the smallest region on the page: everything around it is a
  cached read and arrives with the tap, and this is the one thing that cannot,
  because a prefetch must never credit a day nobody opened.

  What it draws is a card that is already on screen and two toasts that are
  almost always nothing, so there is no gap here for a player to see -- only,
  once a day, a number going up.
*/
async function Visit({ userId }: { userId: string }) {
  /*
    Says out loud that this region is request-time, which it always was.

    Crediting a visit reads the clock to know what day it is, and reading the
    clock is a runtime value under Cache Components in the same way reading a
    cookie is. Without this line the framework tries to prerender it anyway,
    hits new Date(), and gives up on prerendering the route -- so Home had no
    App Shell at all, and every region of it arrived after the tap rather than
    with it. One uncached clock read at the bottom of the page cost the whole
    room its shell.

    connection() is the documented way to say "not at build time, and I mean
    it". The Suspense boundary above already holds this region's place with
    the streak card drawn from a cached read, so nothing here is waited on.
  */
  await connection();

  const activity = await recordVisit(userId);
  if (!activity) return null;

  return (
    <>
      <EarnedToast earned={activity.earned} />
      <BonusToast bonuses={activity.bonuses} />
      <TrackView
        event="streak_viewed"
        properties={{ counted: activity.streak.countedToday }}
      />
      <StreakCard streak={activity.streak} />
    </>
  );
}

async function Rest() {
  const { user, profile } = await getSession();

  /*
    The streak as it stands, read rather than credited.

    Crediting it is a write, and a write cannot be prefetched: this region is
    fetched before the tap so that it can arrive complete, and a prefetch that
    credited a visit would count a day the player never opened. So the number
    shown here comes from a cached read, and the crediting happens in its own
    small region below, on a real visit only.
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
        readStreak(user.id),
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
    What moved today, including anything they hold.

    After the wave above rather than in it, because it wants to know what they
    own before it can mark a row as theirs. It costs one batched quote request
    for a watchlist that is the same for everybody, so it is a cache hit for
    all but the first person to look in any given minute -- which is the cost
    model the plan asks for: per symbol, not per player.
  */
  const [movers, marks] = await Promise.all([
    getMovers(view.positions.map((position) => position.symbol)),

    /*
      Every close this portfolio has been marked at, which is what turns the
      one figure at the top of the screen into a week with a shape. Alongside
      the movers rather than after them: neither wants anything the other has.
    */
    getDailyMarks(view.portfolioId),
  ]);

  /*
    The week so far, today included as a bar that can still move.

    Reading the clock is safe here and nowhere above: this whole region is
    behind a Suspense boundary, so it runs on the request rather than at
    build time, and "today" is the player's today rather than the day the
    site was compiled.
  */
  const today = await todayInNewYork();

  const days = weekSoFar({
    monday: view.cycle.monday,
    marks,
    today,
    liveReturnPercent: view.returnPercent,
  });

  /*
    Today, which by Thursday is the only part still moving.

    The week's figure changes by a fraction of a per cent on a good day and
    reads as the number it read yesterday. What is actually happening is the
    day inside it, measured against last night's close rather than against
    what the week started with -- a different sum, and the one somebody means
    when they ask how it is going.

    Only while the market has actually been open. Before the bell, at the
    weekend, and on a Monday with no close behind it, the honest answer is
    that today has not done anything, and "Today +0.0%" is a figure invented
    to fill a line.
  */
  const move = (await marketHasOpened())
    ? dayMove(view.totalValue, lastCloseBefore(marks, today))
    : null;

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

          {/*
            How the week went, not just where it ended up.

            The scoreboard says one number, and one number cannot tell a week
            that has climbed all week from one that fell on Monday and has
            been clawing back since. Both of those are the same figure on a
            Thursday and completely different weeks to be having.

            Nothing here is invented: every filled bar is a close that was
            recorded on the day it happened, and the outlined one is today,
            drawn from the same live prices as the figure above it.
          */}
          {worthDrawing(days) ? (
            <Panel
              title="Your week so far"
              description="Each bar is where the week stood at that day's close. The outlined one is today, and it can still move."
              action={
                move ? (
                  <span className="figure flex items-baseline gap-1.5 text-sm">
                    <span className="text-muted-foreground">Today</span>
                    <span
                      className={move.percent >= 0 ? "text-gain" : "text-loss"}
                    >
                      {formatPercent(move.percent)}
                    </span>
                  </span>
                ) : undefined
              }
            >
              <WeekShape days={days} />
              {move ? (
                <p className="text-sm text-muted-foreground">
                  {move.amount >= 0 ? "Up" : "Down"}{" "}
                  <span className="figure">{formatMoney(Math.abs(move.amount))}</span>{" "}
                  since last night&rsquo;s close.
                </p>
              ) : null}
            </Panel>
          ) : null}

          {inviteReason ? (
            <NotificationInvite
              reason={inviteReason}
              kind={inviteKind}
              publicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ""}
            />
          ) : null}

          {/*
            The streak, and the one write Home still does.

            The fallback is the card itself, drawn from the read above, so
            this space is filled from the first frame rather than empty. What
            streams in behind it is the same card with today's visit counted,
            plus whatever that visit earned. On every view but the first of a
            day the two are identical and nothing appears to happen; on that
            one the number ticks up, which is the card doing its job rather
            than the page still loading.
          */}
          <Suspense
            fallback={activity ? <StreakCard streak={activity.streak} /> : null}
          >
            <Visit userId={user.id} />
          </Suspense>

          {movers ? <Movers movers={movers} /> : null}

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

        {/*
          On a phone this column is not beside the other one, it is after all
          of it -- and in somebody's first week that is the wrong way round. A
          new player met a market comparison, a chart of a week they have not
          had, an offer of notifications, a streak of one, what moved today and
          an empty "what you own" before reaching the list that tells them what
          to do.

          So for that one week, and only below the width where the two columns
          are actually side by side, this one goes first. Everything in it is
          what a new player needs: the list, and the battle their league may
          have started. Nothing moves on a desktop, where the two are level
          anyway.
        */}
        <div className={`${COLUMN} ${showFirstWeek ? "max-lg:order-first" : ""}`}>
          {/*
            The first week's list, while it is still their first week.

            Bounded by weeks played rather than left to run until the last box
            is ticked. A player two months in who has never declared a goal has
            not failed to finish anything -- they have decided they do not want
            that part -- and a panel telling them so every Monday would be
            nagging.
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
