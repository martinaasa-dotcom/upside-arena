import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Panel } from "@/components/Panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmAction } from "@/components/ConfirmAction";
import { InviteCode } from "@/components/InviteCode";
import { StandingsTable } from "@/components/StandingsTable";
import { WeeklyGoal } from "@/components/WeeklyGoal";
import { getSession } from "@/lib/profile";
import { getLeagueStandings } from "@/lib/game/leagues";
import { getBattleView, getLeagueBattle } from "@/lib/game/battles";
import { FORM_WEEKS, getLeagueRecord } from "@/lib/game/record";
import { FormStrip } from "@/components/LeagueRecord";
import { BattleCard } from "@/components/BattleCard";
import { StartBattleForm } from "@/components/StartBattleForm";
import { getGoals } from "@/lib/game/goals";
import { goalLabel, goalMet } from "@/lib/game/goal-kinds";
import { getWeekStreaks } from "@/lib/game/streaks";
import { tradingDaysSoFarThisWeek } from "@/lib/market/session";
import { submitLeaveLeague } from "@/app/(app)/leagues/actions";
import { COLUMN, PAGE, SPLIT, STACK } from "@/lib/page-shell";
import { TrackView } from "@/components/TrackView";
import { formatGap, formatPercent } from "@/lib/format";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { user } = await getSession();
  if (!user) return { title: "League" };
  const data = await getLeagueStandings(user.id, (await params).id);
  return { title: data?.league.name ?? "League" };
}

/*
  The way back is the room. It is the same for every league and needs nothing,
  so it is prerendered and on screen with the tap; everything else streams
  under it.

  Four regions rather than one, and the split is by what they read rather than
  by how the page looks. The table is the expensive one -- every member's book,
  priced from live quotes -- and the two things that used to sit behind it in
  the same region are not: a league's battle is one row, and its record is a
  handful of indexed counts. Sharing a boundary meant nothing appeared until
  the slowest of the three had finished.

  They are ordered here rather than nested, so each starts at once and lands in
  the right place. The reads inside them are memoised for the request, so four
  regions asking for the same league cost one read of it.
*/
export default function LeaguePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <div className={`${PAGE} ${STACK}`}>
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2">
          <Link href="/leagues">
            <ArrowLeft />
            All leagues
          </Link>
        </Button>
      </div>

      <Suspense fallback={null}>
        <Heading params={params} />
      </Suspense>

      {/*
        The week and what it remembers on the left, what to do next on the
        right. One column under lg, in this order.
      */}
      <div className={SPLIT}>
        <div className={COLUMN}>
          <Suspense fallback={null}>
            <Battle params={params} />
          </Suspense>

          <Suspense fallback={<Panel title="This week" />}>
            <ThisWeek params={params} />
          </Suspense>

          <Suspense fallback={null}>
            <Form params={params} />
          </Suspense>
        </div>

        <div className={COLUMN}>
          <Suspense fallback={null}>
            <Aside params={params} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

type Params = { params: Promise<{ id: string }> };

/**
 * The league behind this route, or nothing.
 *
 * Every region asks through here rather than being handed one. It is memoised
 * for the length of the request, so the four of them share one read of the
 * roster, the profiles, the portfolios and the batch of quotes.
 */
async function standingsFor(params: Promise<{ id: string }>) {
  const { user } = await getSession();
  if (!user) return null;

  const { id } = await params;
  return getLeagueStandings(user.id, id);
}

async function Heading({ params }: Params) {
  const data = await standingsFor(params);
  if (!data) return null;

  const { league, benchmarkReturnPercent } = data;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h1 className="flex items-center gap-2">
        <span aria-hidden="true">{league.icon ?? "\u{1F3C6}"}</span>
        {league.name}
      </h1>
      <div className="flex items-center gap-2">
        <Badge variant="outline">
          {league.memberCount} of {league.maxMembers}
        </Badge>
        {benchmarkReturnPercent != null ? (
          <Badge variant={benchmarkReturnPercent >= 0 ? "gain" : "loss"}>
            Market {formatPercent(benchmarkReturnPercent)}
          </Badge>
        ) : null}
      </div>
    </div>
  );
}

/*
  The league's own contest, above the week. The week is the race everybody is
  in anyway; the battle is the one this league chose.
*/
async function Battle({ params }: Params) {
  const { user } = await getSession();
  if (!user) return null;

  const { id } = await params;
  const battle = await getLeagueBattle(user.id, id);
  if (!battle) return null;

  /*
    A finished battle says how it went on the card, so somebody scrolling past
    the league page learns they won without having to open anything. Only for a
    settled one: a running battle's standing belongs inside the room, where it
    is live, rather than in a second staler copy out here.
  */
  const result = battle.finished
    ? await getBattleView(user.id, battle.cycleId)
    : null;

  return (
    <BattleCard
      battle={battle}
      href={`/leagues/${id}/battle`}
      result={
        result?.you
          ? {
              rank: result.you.rank,
              players: result.standings.length,
              returnPercent: result.you.returnPercent,
            }
          : null
      }
    />
  );
}

async function ThisWeek({ params }: Params) {
  const { user } = await getSession();
  if (!user) redirect("/");

  const { id } = await params;
  const data = await getLeagueStandings(user.id, id);

  // Not a member, or no such league. Both are "nothing here for you", and
  // telling them apart would confirm a league exists to someone guessing.
  if (!data) notFound();

  const { league, cycle, standings, rival } = data;
  const you = standings.find((s) => s.isYou);

  /*
    What everybody said they would do this week, and how it is going. Worked
    out here from the standings that were just computed rather than stored,
    so a goal is never a second opinion about a result.
  */
  const [goals, weekStreaks] = await Promise.all([
    getGoals(league.id, cycle.id),
    getWeekStreaks(standings.map((row) => row.userId)),
  ]);

  const tradingDaysSoFar = tradingDaysSoFarThisWeek();

  const goalFor = (userId: string) => {
    const goal = goals.get(userId);
    if (!goal) return null;

    const standing = standings.find((row) => row.userId === userId);
    if (!standing) return null;

    return {
      label: goalLabel(goal.kind),
      met: goalMet(goal.kind, standing, {
        streakThisWeek: weekStreaks.get(userId) ?? 0,
        tradingDaysSoFar,
      }),
    };
  };

  return (
    <>
      <TrackView event="standings_viewed" />

      {/*
        The named rival, before the table. A list of names is something to
        scan; one person you are 0.4% behind is something to act on.
      */}
      {rival ? (
        <Panel>
          <p className="text-sm">
            You are{" "}
            <span className="figure text-loss">{formatGap(rival.behindBy)}</span>{" "}
            behind <span className="font-semibold">{rival.name}</span>.{" "}
            <span className="text-muted-foreground">
              One good day closes that.
            </span>
          </p>
        </Panel>
      ) : you?.rank === 1 && standings.length > 1 ? (
        <Panel>
          <p className="text-sm">
            You are top of the league.{" "}
            <span className="text-muted-foreground">
              There is a whole week left, so hold on to it.
            </span>
          </p>
        </Panel>
      ) : null}

      <Panel
        title="This week"
        description={
          standings.length < 2
            ? "This is your week so far. It becomes a table when somebody else is in here."
            : "Everyone started Monday with the same money."
        }
      >
        <StandingsTable standings={standings} goalFor={goalFor} />
      </Panel>

      <WeeklyGoal
        leagueId={league.id}
        declared={goals.get(user.id)?.kind ?? null}
      />
    </>
  );
}

/*
  The last few weeks, and who won them.

  A league resets every Monday and used to remember nothing, which is right for
  the game and exactly wrong for the reason people stay: nobody argues about a
  table that forgets. This is the reminder that there was a last week; the
  record room behind it is where somebody goes looking.
*/
async function Form({ params }: Params) {
  const { user } = await getSession();
  if (!user) return null;

  const { id } = await params;
  const record = await getLeagueRecord(user.id, id);
  if (!record || record.weeks.length === 0) return null;

  return (
    <FormStrip
      weeks={record.weeks.slice(0, FORM_WEEKS)}
      you={record.you}
      href={`/leagues/${id}/record`}
    />
  );
}

/** Starting a battle, the invite code, and the way out. */
async function Aside({ params }: Params) {
  const { user } = await getSession();
  if (!user) return null;

  const { id } = await params;
  const [data, battle] = await Promise.all([
    getLeagueStandings(user.id, id),
    getLeagueBattle(user.id, id),
  ]);

  if (!data) return null;
  const { league } = data;

  /*
    A league of one is the state everybody starts in and the one the product
    does not work in: a table with a single row, a rival panel with nobody to
    name, and a battle that would be a contest against nothing. /metrics
    already counts these separately and calls them what they are -- a failed
    invite -- and the screen may as well say so too.

    So the invite goes first and says the true thing, and the battle form waits
    until there is somebody to have a battle with.
  */
  const alone = league.memberCount < 2;

  return (
    <>
      {alone ? (
        <Panel
          title="Nobody else is here yet"
          description="A league of one is a spreadsheet. Send this code to one person and it becomes a game. That is the whole difference, and two is enough."
        >
          <InviteCode code={league.inviteCode} leagueName={league.name} />
        </Panel>
      ) : null}

      {/*
        A league with a battle running does not get offered another. One at a
        time is the whole point: four contests at once is four scoreboards and
        no conversation.

        And a league of one is not offered one at all. A battle is a contest
        between people, and starting one against nobody would be four screens
        of setup for a table with a single row on it.
      */}
      {alone || (battle && !battle.finished) ? null : (
        <StartBattleForm leagueId={league.id} />
      )}

      {alone ? null : (
        <Panel
          title="Invite someone"
          description="Anyone with this code can join. Send it to people you want in, not to a public place."
        >
          <InviteCode code={league.inviteCode} leagueName={league.name} />
        </Panel>
      )}

      <Panel
        title="Leave this league"
        description={
          league.isOwner
            ? "You made this league. If you leave, it passes to whoever joined first, so nobody loses their standings."
            : "You can come back later with the same code."
        }
      >
        <ConfirmAction
          action={submitLeaveLeague}
          fields={{ leagueId: league.id }}
          label="Leave league"
          title={`Leave ${league.name}?`}
          description={
            league.isOwner
              ? "The league carries on without you and passes to whoever joined first. You can rejoin with the same code, and nobody's standings change."
              : "You drop out of this week's table here. You can rejoin with the same code whenever you like."
          }
          confirmLabel="Leave"
          cancelLabel="Stay in"
        />
      </Panel>
    </>
  );
}
