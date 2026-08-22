import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { Panel } from "@/components/Panel";
import { CreateLeagueForm, JoinLeagueForm } from "@/components/LeagueForms";
import { getSession } from "@/lib/profile";
import { getLeagues } from "@/lib/game/leagues";
import { getPodView } from "@/lib/game/pods";
import { getCurrentCycle } from "@/lib/game/portfolio";
import { PodStandings } from "@/components/PodStandings";
import { PAGE, STACK } from "@/lib/page-shell";

export const metadata = { title: "Leagues" };

export default async function LeaguesPage() {
  const { user } = await getSession();
  if (!user) redirect("/");

  /*
    The pod, when there is one. Section 2.2 keeps these switched off until
    enough people are playing to fill them, so this is usually nothing and
    the page reads exactly as it did before. It sits above the private
    leagues because it is the one somebody did not choose to be in, so it is
    the one they have not already seen.
  */
  const [leagues, cycle] = await Promise.all([
    getLeagues(user.id),
    getCurrentCycle(),
  ]);
  const pod = cycle ? await getPodView(user.id, cycle.id, null) : null;

  return (
    <div className={`${PAGE} ${STACK}`}>
      <h1>Leagues</h1>

      {pod ? <PodStandings view={pod} /> : null}

      {leagues.length > 0 ? (
        <Panel title="Your leagues">
          <div className="flex flex-col gap-2">
            {leagues.map((league) => (
              <Link
                key={league.id}
                href={`/leagues/${league.id}`}
                className="glass-well flex h-14 items-center gap-3 rounded-lg px-4 transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <span className="text-lg" aria-hidden="true">
                  {league.icon ?? "\u{1F3C6}"}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                  {league.name}
                </span>
                <span className="figure shrink-0 text-sm text-muted-foreground">
                  {league.memberCount}{" "}
                  {league.memberCount === 1 ? "player" : "players"}
                </span>
                <ChevronRight
                  className="size-4 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
              </Link>
            ))}
          </div>
        </Panel>
      ) : (
        <Panel
          title="You are not in a league yet"
          description="A league is where the game happens. Start one and invite a couple of friends, or put in a code someone sent you. Two people is enough."
        />
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <CreateLeagueForm />
        <JoinLeagueForm />
      </div>
    </div>
  );
}
