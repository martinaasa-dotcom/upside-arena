import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Panel } from "@/components/Panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InviteCode } from "@/components/InviteCode";
import { StandingsTable } from "@/components/StandingsTable";
import { getSession } from "@/lib/profile";
import { getLeagueStandings } from "@/lib/game/leagues";
import { submitLeaveLeague } from "@/app/(app)/leagues/actions";
import { PAGE, STACK } from "@/lib/page-shell";
import { TrackView } from "@/components/TrackView";
import { formatGap, formatPercent } from "@/lib/format";

export const dynamic = "force-dynamic";

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

export default async function LeaguePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { user } = await getSession();
  if (!user) redirect("/");

  const { id } = await params;
  const data = await getLeagueStandings(user.id, id);

  // Not a member, or no such league. Both are "nothing here for you", and
  // telling them apart would confirm a league exists to someone guessing.
  if (!data) notFound();

  const { league, standings, benchmarkReturnPercent, rival } = data;
  const you = standings.find((s) => s.isYou);

  return (
    <div className={`${PAGE} ${STACK}`}>
      <TrackView event="standings_viewed" />
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2">
          <Link href="/leagues">
            <ArrowLeft />
            All leagues
          </Link>
        </Button>

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
      </div>

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

      <Panel title="This week" description="Everyone started Monday with the same money.">
        <StandingsTable standings={standings} />
      </Panel>

      <Panel
        title="Invite someone"
        description="Anyone with this code can join. Send it to people you want in, not to a public place."
      >
        <InviteCode code={league.inviteCode} leagueName={league.name} />
      </Panel>

      <Panel
        title="Leave this league"
        description={
          league.isOwner
            ? "You made this league. If you leave, it passes to whoever joined first, so nobody loses their standings."
            : "You can come back later with the same code."
        }
      >
        <form action={submitLeaveLeague}>
          <input type="hidden" name="leagueId" value={league.id} />
          <Button type="submit" variant="outline">
            Leave league
          </Button>
        </form>
      </Panel>
    </div>
  );
}
