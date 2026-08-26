import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DraftRoom } from "@/components/DraftRoom";
import { TrackView } from "@/components/TrackView";
import { getSession } from "@/lib/profile";
import { getDraftShell, getDraftState, getLeagueDraft } from "@/lib/game/draft";
import { getLeagueBattle } from "@/lib/game/battles";
import { PAGE, STACK } from "@/lib/page-shell";

/*
  The draft room's route.

  One screen and no tabs, for the reason the battle room has none: everything
  here is one moment, and a board you have to navigate back to after every pick
  is not a board.

  The way back is prerendered and lands with the tap. The room itself streams,
  because it needs the league, the draft, the seats and a quote for every name
  on the board before it can draw a tile.

  A draft that has already been bought is not a room any more, it is a battle,
  so it redirects rather than showing a board nobody can touch. Somebody who
  wants to see what everybody drafted finds it in the battle's own reveal, once
  it settles, which is the same rule every other contest here follows.
*/
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { user } = await getSession();
  if (!user) return { title: "Draft" };

  const found = await getLeagueDraft(user.id, (await params).id);
  return { title: found ? "Draft night" : "Draft" };
}

export default function DraftPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <div className={`${PAGE} ${STACK}`}>
      <TrackView event="draft_viewed" />

      <div>
        <Suspense fallback={null}>
          <BackLink params={params} />
        </Suspense>
      </div>

      <Suspense fallback={null}>
        <Room params={params} />
      </Suspense>
    </div>
  );
}

async function BackLink({ params }: { params: Promise<{ id: string }> }) {
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

async function Room({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user } = await getSession();
  if (!user) redirect("/");

  const found = await getLeagueDraft(user.id, id);
  if (!found) notFound();

  /*
    Bought, or over. Either way the room with the result in it is the battle's.
    The second case is a draft nobody finished picking, which still reaches its
    end date and is still scored.
  */
  if (found.draft.status === "filled") redirect(`/leagues/${id}/battle`);

  const battle = await getLeagueBattle(user.id, id);
  if (battle?.finished) redirect(`/leagues/${id}/battle`);

  const [shell, state] = await Promise.all([
    getDraftShell(user.id, found.draft.id),
    getDraftState(user.id, found.draft.id),
  ]);

  if (!shell || !state) notFound();

  return <DraftRoom shell={shell} initial={state} />;
}
