import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { Panel } from "@/components/Panel";
import { CreateLeagueForm, JoinLeagueForm } from "@/components/LeagueForms";
import { getSession } from "@/lib/profile";
import { getLeaguePositions, getLeagues } from "@/lib/game/leagues";
import { getLiveBattles } from "@/lib/game/battles";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatPercent, ordinal } from "@/lib/format";
import { getPodView } from "@/lib/game/pods";
import { getCurrentCycle } from "@/lib/game/portfolio";
import { PodStandings } from "@/components/PodStandings";
import { PAGE, STACK } from "@/lib/page-shell";

export const metadata = { title: "Leagues" };

/*
  The heading and the two forms are the room and need nothing, so they are
  prerendered and land with the tap. Which leagues somebody is in, and the pod
  they were placed in, stream into the middle.
*/
export default function LeaguesPage() {
  return (
    <div className={`${PAGE} ${STACK}`}>
      <h1>Leagues</h1>

      <Suspense fallback={null}>
        <Pod />
      </Suspense>

      <Suspense fallback={<Panel title="Your leagues" />}>
        <Leagues />
      </Suspense>

      <div className="grid gap-6 lg:grid-cols-2">
        <CreateLeagueForm />
        <JoinLeagueForm />
      </div>
    </div>
  );
}

/*
  Section 2.2 keeps pods switched off until enough people are playing to fill
  them, so this is usually nothing and the page reads as it did before. It sits
  above the private leagues because it is the one somebody did not choose to be
  in, so it is the one they have not already seen.
*/
async function Pod() {
  const { user } = await getSession();
  if (!user) return null;

  const cycle = await getCurrentCycle();
  const pod = cycle ? await getPodView(user.id, cycle.id, null) : null;
  return pod ? <PodStandings view={pod} /> : null;
}

/*
  Where you stand in each, not just what they are called.

  This was a list of names and member counts, which is the one thing somebody
  opening it already knows. What they want is whether they are winning, and
  which of their leagues has something going on in it.

  Both of the reads behind that are one round trip regardless of how many
  leagues somebody is in -- see getLeaguePositions, which is written that way
  precisely because the obvious version is six queries per league, ten times
  over on the free tier's limit.
*/
async function Leagues() {
  const { user } = await getSession();
  if (!user) redirect("/");

  const leagues = await getLeagues(user.id);

  if (leagues.length === 0) {
    return (
      <Panel
        title="You are not in a league yet"
        description="A league is where the game happens. Start one and invite a couple of friends, or put in a code someone sent you. Two people is enough."
      />
    );
  }

  const [positions, battles] = await Promise.all([
    getLeaguePositions(
      user.id,
      leagues.map((league) => league.id)
    ),
    getLiveBattles(user.id),
  ]);

  const battleByLeague = new Map(battles.map((battle) => [battle.leagueId, battle]));

  return (
    <Panel title="Your leagues">
      <div className="flex flex-col gap-2">
        {leagues.map((league) => {
          const position = positions.get(league.id);
          const battle = battleByLeague.get(league.id);
          const alone = league.memberCount < 2;

          return (
            <Link
              key={league.id}
              href={`/leagues/${league.id}`}
              className="glass-well flex min-h-16 items-center gap-3 rounded-lg px-4 py-2 transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <span className="shrink-0 text-lg" aria-hidden="true">
                {league.icon ?? "\u{1F3C6}"}
              </span>

              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-sm font-medium">{league.name}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {alone
                    ? "Nobody else yet — send them the code"
                    : position?.leader
                      ? `${position.leader.displayName} is top`
                      : position
                        ? "You are top"
                        : `${league.memberCount} players`}
                </span>
              </span>

              {battle ? (
                <Badge variant="outline" className="hidden shrink-0 sm:inline-flex">
                  <span aria-hidden="true">{battle.format.icon}</span>
                  {battle.format.name}
                </Badge>
              ) : null}

              {position && !alone ? (
                <span className="flex shrink-0 flex-col items-end">
                  <span className="figure text-sm font-semibold">
                    {ordinal(position.rank)} of {position.players}
                  </span>
                  <span
                    className={cn(
                      "figure text-xs",
                      position.returnPercent >= 0 ? "text-gain" : "text-loss"
                    )}
                  >
                    {formatPercent(position.returnPercent)}
                  </span>
                </span>
              ) : null}

              <ChevronRight
                className="size-4 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
            </Link>
          );
        })}
      </div>
    </Panel>
  );
}
