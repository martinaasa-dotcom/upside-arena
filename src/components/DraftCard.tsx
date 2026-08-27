import Link from "next/link";
import { ListOrdered, Timer, Users } from "lucide-react";
import { Panel } from "@/components/Panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { pickClockLabel } from "@/lib/game/draft-order";
import type { DraftRow } from "@/lib/supabase/database.types";
import type { Format } from "@/lib/game/formats";
import { SettingBar } from "@/components/ui/setting-row";

/*
  A draft on the league page, before it has been bought.

  It sits where the battle card would, because it is the same slot: a draft is
  a battle, and a league has one contest at a time. What it must not do is look
  like a battle that is already running, because the whole of what it wants
  from somebody is to come to the room, and a card that reads as a scoreboard
  gets read rather than tapped.

  So there is no figure on it. The three things it says are what game, who is
  in, and whether it needs you now.
*/
export function DraftCard({
  draft,
  format,
  seats,
  href,
  youAreSeated,
}: {
  draft: DraftRow;
  format: Format;
  seats: number;
  href: string;
  youAreSeated: boolean;
}) {
  const waiting = draft.status === "waiting";
  const picking = draft.status === "picking";

  return (
    <Panel>
      <div className="flex flex-col gap-3">
        <SettingBar
          action={
            <>
              <Badge variant={picking ? "default" : "outline"}>
                {waiting ? "Open" : picking ? "Picking" : "All picked"}
              </Badge>
              <Button asChild size="sm">
                <Link href={href}>
                  {draft.status === "picked"
                    ? "See the board"
                    : youAreSeated
                      ? "Open the room"
                      : "Join it"}
                </Link>
              </Button>
            </>
          }
          description={`${format.name}, ${draft.rounds} names each, ${pickClockLabel(draft.pick_seconds).toLowerCase()}.`}
        >
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="card-sheen glass-well rounded-xl p-2 text-primary">
              <ListOrdered className="size-4" aria-hidden="true" />
            </div>
            <h2 className="truncate text-lg font-semibold tracking-tight">
              Draft night
            </h2>
          </div>
        </SettingBar>
        <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Users className="size-3.5" aria-hidden="true" />
            {seats} {seats === 1 ? "person" : "people"} in
          </span>
          {picking ? (
            <span className="inline-flex items-center gap-1.5">
              <Timer className="size-3.5" aria-hidden="true" />
              Somebody is on the clock
            </span>
          ) : null}
        </p>
      </div>
    </Panel>
  );
}
