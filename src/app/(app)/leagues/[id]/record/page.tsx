import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Panel } from "@/components/Panel";
import { Button } from "@/components/ui/button";
import { Score, Scoreboard } from "@/components/Scoreboard";
import {
  HeadToHeadTable,
  HonoursBoard,
  WeekLog,
} from "@/components/LeagueRecord";
import { getSession } from "@/lib/profile";
import { getLeagueRecord } from "@/lib/game/record";
import { getLastWeekBooks } from "@/lib/game/books";
import { Reveal } from "@/components/Reveal";
import { COLUMN, PAGE, SPLIT, STACK } from "@/lib/page-shell";
import { formatDate, formatPercent, plural } from "@/lib/format";

/*
  The record room.

  Everywhere else in Arena is this week. This is the only screen that is about
  every week before it, and it exists because a league that forgets is a league
  nobody argues about.

  Nothing here is computed live. Every figure was settled on a Friday and
  written to a portfolio at the time; this counts those rows and puts names to
  them. A record that could disagree with the week it came from would be two
  versions of one result, which is worse than having no record at all.
*/

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { user } = await getSession();
  if (!user) return { title: "The record" };

  const record = await getLeagueRecord(user.id, (await params).id);
  return { title: record ? `${record.league.name} record` : "The record" };
}

export default function RecordPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <div className={`${PAGE} ${STACK}`}>
      <div>
        <Suspense
          fallback={
            <Button variant="ghost" size="sm" className="-ml-2 mb-2" disabled>
              <ArrowLeft />
              Back
            </Button>
          }
        >
          <BackToLeague params={params} />
        </Suspense>
        <h1>The record</h1>
      </div>

      <Scoreboard>
        <Suspense fallback={<Score label="Weeks played here" value="—" as="text" />}>
          <WeeksScore params={params} />
        </Suspense>
        <Suspense fallback={<Score label="Weeks you won" value="—" as="text" />}>
          <WinsScore params={params} />
        </Suspense>
        <Suspense
          fallback={
            <Score label="Ahead of the market" value="—" as="text" hint="per week" />
          }
        >
          <AlphaScore params={params} />
        </Suspense>
        <Suspense fallback={<Score label="Your best week" value="—" as="text" />}>
          <BestScore params={params} />
        </Suspense>
      </Scoreboard>

      <Suspense fallback={null}>
        <Rest params={params} />
      </Suspense>
    </div>
  );
}

type Params = { params: Promise<{ id: string }> };

async function recordFor(params: Promise<{ id: string }>) {
  const { user } = await getSession();
  if (!user) return null;

  const { id } = await params;
  return getLeagueRecord(user.id, id);
}

async function LastWeek({ params }: Params) {
  const { user } = await getSession();
  if (!user) return null;

  const { id } = await params;
  const week = await getLastWeekBooks(user.id, id);
  if (!week || week.books.length === 0) return null;

  return (
    <Panel
      title="What everybody held last week"
      description={`Week of ${formatDate(week.monday)}, settled at Friday's close. Shown now that it is over and nobody can copy it.`}
    >
      <Reveal books={week.books} />
    </Panel>
  );
}

async function BackToLeague({ params }: Params) {
  const { id } = await params;

  return (
    <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2">
      <Link href={`/leagues/${id}`}>
        <ArrowLeft />
        Back to the league
      </Link>
    </Button>
  );
}

async function WeeksScore({ params }: Params) {
  const record = await recordFor(params);

  return (
    <Score
      label="Weeks played here"
      value={record?.you?.weeks ?? 0}
      hint={
        record && record.weeks.length > 0
          ? `${plural(record.weeks.length, "week")} this league has run`
          : undefined
      }
    />
  );
}

async function WinsScore({ params }: Params) {
  const record = await recordFor(params);
  const you = record?.you ?? null;

  return (
    <Score
      label="Weeks you won"
      value={you?.wins ?? 0}
      tone={you && you.wins > 0 ? "gain" : "neutral"}
      hint={you && you.weeks > 0 ? `of ${plural(you.weeks, "week")}` : undefined}
    />
  );
}

async function AlphaScore({ params }: Params) {
  const record = await recordFor(params);
  const you = record?.you ?? null;

  return (
    <Score
      label="Ahead of the market"
      value={you && you.weeks > 0 ? formatPercent(you.averageVersusMarket) : "Not yet"}
      as={you && you.weeks > 0 ? "figure" : "text"}
      tone={
        !you || you.weeks === 0
          ? "neutral"
          : you.averageVersusMarket >= 0
            ? "gain"
            : "loss"
      }
      hint="per week you played"
    />
  );
}

async function BestScore({ params }: Params) {
  const record = await recordFor(params);
  const best = record?.you?.bestWeek ?? null;

  return (
    <Score
      label="Your best week"
      value={best == null ? "Not yet" : formatPercent(best)}
      as={best == null ? "text" : "figure"}
      tone={best == null ? "neutral" : best >= 0 ? "gain" : "loss"}
      hint="in this league"
    />
  );
}

async function Rest({ params }: Params) {
  const { user } = await getSession();
  if (!user) redirect("/");

  const { id } = await params;
  const record = await getLeagueRecord(user.id, id);

  // Not a member, or no such league. Both are "nothing here for you".
  if (!record) notFound();

  if (record.weeks.length === 0) {
    return (
      <Panel
        title="Nothing to remember yet"
        description="This fills in on Friday, when the first week anybody here played is scored. Until then there is only this week, which is the whole point of the game."
      />
    );
  }

  return (
    <div className={SPLIT}>
      <div className={COLUMN}>
        <Panel
          title="Weeks won"
          description="Ordered on weeks won, because that is the number people say out loud. A tie breaks on how far ahead of the market they finished per week, so winning three of four beats winning three of forty."
        >
          <HonoursBoard honours={record.honours} />
        </Panel>

        <Panel
          title="Every week"
          description="Newest first. Settled on Friday's closing prices, and never worked out again since."
        >
          <WeekLog weeks={record.weeks} />
        </Panel>
      </div>

      <div className={COLUMN}>
        {/*
          What everybody was actually holding, for the week that just ended.

          The reveal was built for battles first, which was the wrong way
          round: a battle needs a league to have decided to start one, and the
          week happens to all of them every Monday. This is the one that will
          be read.

          Its own boundary because it is four more queries than the rest of
          this room needs, and none of the panels beside it should wait on
          them.
        */}
        <Suspense fallback={null}>
          <LastWeek params={params} />
        </Suspense>

        {record.headToHead.length > 0 ? (
          <Panel
            title="You against each of them"
            description="Weeks you both played, and how often you finished above them. Weeks before either of you joined are not counted, because they are not weeks anybody lost."
          >
            <HeadToHeadTable rows={record.headToHead} />
          </Panel>
        ) : null}
      </div>
    </div>
  );
}
