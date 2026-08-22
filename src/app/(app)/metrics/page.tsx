import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Panel } from "@/components/Panel";
import { HairlineCell, HairlineGrid } from "@/components/HairlineGrid";
import { Scoreboard, Score } from "@/components/Scoreboard";
import { getSession } from "@/lib/profile";
import { isAdmin } from "@/lib/env";
import { getMetrics } from "@/lib/metrics";
import { percentOf } from "@/lib/metrics/ratio";
import { PAGE, STACK } from "@/lib/page-shell";
import { plural } from "@/lib/format";

/*
  The four numbers the loop is tuned by, on one screen.

  Owner only, and hidden rather than refused: a page that says "you are not
  allowed" tells a stranger the page exists. This one is simply not there.

  Everything here is a count. No player is named, no trade is listed, and
  nothing on this screen could identify anybody, which is what makes it
  reasonable to compute over everyone including the people who declined
  measurement.
*/

export const metadata = { title: "Numbers" };

/** A percentage, or the honest answer when there is nothing to divide. */
function Percent({ part, whole }: { part: number; whole: number }) {
  const value = percentOf(part, whole);

  if (value == null) {
    // Zero percent reads as a verdict. Nothing yet reads as the truth.
    return <span className="text-lg font-semibold text-muted-foreground">Nothing yet</span>;
  }

  return <span className="figure text-lg font-semibold">{value.toFixed(0)}%</span>;
}

function Row({
  label,
  detail,
  part,
  whole,
}: {
  label: string;
  detail: string;
  part: number;
  whole: number;
}) {
  return (
    <HairlineCell>
      <span className="text-sm text-muted-foreground">{label}</span>
      <Percent part={part} whole={whole} />
      <span className="text-xs text-muted-foreground">
        {part} of {whole}. {detail}
      </span>
    </HairlineCell>
  );
}

/*
  The heading is the room. Every count under it is a database read, so it
  streams rather than holding the page.
*/
export default function MetricsPage() {
  return (
    <div className={`${PAGE} ${STACK}`}>
      <h1>Numbers</h1>
      <Suspense fallback={null}>
        <Counts />
      </Suspense>
    </div>
  );
}

async function Counts() {
  const { user } = await getSession();

  // Not a refusal. A stranger should not learn that this page is here.
  if (!isAdmin(user?.email)) notFound();

  const metrics = await getMetrics();
  const { engagement: e, streaks: s, leagues: l } = metrics;

  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Counted from the database, as of {metrics.asOf}. Nobody is named here.
        </p>
      </div>

      <Scoreboard>
        <Score label="Accounts" value={e.players} />
        <Score label="Here today" value={e.activeToday} />
        <Score label="Here this week" value={e.activeThisWeek} />
        <Score label="Weeks scored" value={e.weeksScored} />
      </Scoreboard>

      <Panel
        title="Coming back"
        description="Of the people who joined long enough ago to have had the chance. Somebody who joined yesterday is not counted against a thirty day figure."
      >
        {metrics.retention.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nobody has been here long enough yet. The first day one figure
            arrives tomorrow.
          </p>
        ) : (
          <HairlineGrid maxColumns={3}>
            {metrics.retention.map((row) => (
              <Row
                key={row.windowDays}
                label={`Within ${plural(row.windowDays, "day")}`}
                detail="came back at least once"
                part={row.returned}
                whole={row.cohort}
              />
            ))}
          </HairlineGrid>
        )}
      </Panel>

      <Panel
        title="Getting started"
        description="Where people stop. Each step is measured against everyone with an account, not against the step before, so a wide gap points at one screen rather than at a chain of them."
      >
        <HairlineGrid maxColumns={3}>
          <Row
            label="Finished setting up"
            detail="chose a name and a tag"
            part={e.onboarded}
            whole={e.players}
          />
          <Row
            label="Made a trade"
            detail="bought or sold at least once"
            part={e.traded}
            whole={e.players}
          />
          <Row
            label="In a league"
            detail="started or joined one"
            part={e.inALeague}
            whole={e.players}
          />
        </HairlineGrid>
      </Panel>

      <Panel
        title="Showing up"
        description="Whether the streak survives contact with real people. The average is not the interesting number: a handful of enthusiasts drag it upwards."
      >
        <HairlineGrid maxColumns={4}>
          <Row
            label="Streak still going"
            detail="have not lost it"
            part={s.alive}
            whole={s.players}
          />
          <Row
            label="Got through a week"
            detail="five trading days in a row"
            part={s.reachedFive}
            whole={s.players}
          />
          <Row
            label="Got through a month"
            detail="twenty trading days in a row"
            part={s.reachedTwenty}
            whole={s.players}
          />
          <HairlineCell>
            <span className="text-sm text-muted-foreground">Freezes spent</span>
            <span className="figure text-lg font-semibold">{s.freezesSpent}</span>
            <span className="text-xs text-muted-foreground">
              Best is {plural(s.longest, "day")}. A high number here means the
              freeze is carrying the streak, not the habit.
            </span>
          </HairlineCell>
        </HairlineGrid>
      </Panel>

      <Panel
        title="Leagues"
        description="A league with one person in it is somebody who tried to invite a friend and failed. That is the most useful failure Arena can see, so it is counted on its own."
      >
        <HairlineGrid maxColumns={3}>
          <Row
            label="Filled"
            detail="have more than one member"
            part={l.withCompany}
            whole={l.leagues}
          />
          <Row
            label="Nobody joined"
            detail="a failed invite"
            part={l.alone}
            whole={l.leagues}
          />
          <HairlineCell>
            <span className="text-sm text-muted-foreground">Fullest league</span>
            <span className="figure text-lg font-semibold">{l.biggest}</span>
            <span className="text-xs text-muted-foreground">
              {l.members} memberships across {plural(l.leagues, "league")}.
            </span>
          </HairlineCell>
        </HairlineGrid>
      </Panel>

      <Panel
        title="Sharing"
        description="Measured against weeks that were actually scored, not against people. Somebody who has never finished a week has not declined to share it."
      >
        <HairlineGrid maxColumns={2}>
          <Row
            label="Weeks shared"
            detail="of the weeks that were scored"
            part={e.weeksShared}
            whole={e.weeksScored}
          />
          <HairlineCell>
            <span className="text-sm text-muted-foreground">Links still live</span>
            <span className="figure text-lg font-semibold">{e.cardsLive}</span>
            <span className="text-xs text-muted-foreground">
              {e.weeksShared - e.cardsLive} taken back down again.
            </span>
          </HairlineCell>
        </HairlineGrid>
      </Panel>

      <Panel title="What is not here">
        <p className="text-sm text-muted-foreground">
          Which buttons people press is measured separately, through the
          consent-gated events, and only for those who agreed to it. Everything
          on this page is counted from the game itself, so it is true for
          everybody. Neither half answers the other one&rsquo;s questions.
        </p>
      </Panel>
    </>
  );
}
