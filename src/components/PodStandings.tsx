import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { Panel, Well } from "@/components/Panel";
import { cn } from "@/lib/utils";
import { formatGap, formatPercent, initials } from "@/lib/format";
import { podZone, type PodView } from "@/lib/game/pods";

/*
  The pod, from section 2.2.

  A public rung rather than somebody's league: nobody here chose to be in it
  with each other, so the thing that makes it worth looking at is the ladder,
  and the ladder is what this leads with.

  Every number is measured. Section 3 allows a near miss only when it is
  true, so the gap to promotion is a real difference between two real weeks
  and is simply absent when there is nothing honest to say.
*/
export function PodStandings({ view }: { view: PodView }) {
  const { pod, standings, moving, toPromotion, toSafety } = view;
  const you = standings.find((row) => row.isYou);

  return (
    <Panel
      title={pod.name}
      description={
        moving === 0
          ? "Nobody moves up or down out of a pod this small. It fills as more people play."
          : `Everyone here started Monday with the same money. The top ${moving} go up on Friday, the bottom ${moving} go down.`
      }
    >
      <div className="flex flex-col gap-4">
        {you && moving > 0 ? (
          <Well className="flex items-start gap-3 py-3">
            {/*
              The drop first. Somebody near the bottom of a pod is both outside
              the promotion places and inside the relegation ones, so both gaps
              are real; the one they need is the one they stand to lose.
            */}
            {toSafety != null ? (
              <>
                <ArrowDown
                  className="mt-0.5 size-4 shrink-0 text-loss"
                  aria-hidden="true"
                />
                <p className="text-sm">
                  You are in the drop, by{" "}
                  <span className="figure text-loss">{formatGap(toSafety)}</span>.{" "}
                  <span className="text-muted-foreground">
                    One good day is usually enough.
                  </span>
                </p>
              </>
            ) : toPromotion != null ? (
              <>
                <ArrowUp
                  className="mt-0.5 size-4 shrink-0 text-primary"
                  aria-hidden="true"
                />
                <p className="text-sm">
                  You are{" "}
                  <span className="figure text-loss">{formatGap(toPromotion)}</span>{" "}
                  off going up.{" "}
                  <span className="text-muted-foreground">
                    There is a week left to close it.
                  </span>
                </p>
              </>
            ) : (
              <>
                <ArrowUp
                  className="mt-0.5 size-4 shrink-0 text-gain"
                  aria-hidden="true"
                />
                <p className="text-sm">
                  You are on your way up.{" "}
                  <span className="text-muted-foreground">
                    Hold it to Friday and you move a rung.
                  </span>
                </p>
              </>
            )}
          </Well>
        ) : null}

        <div className="flex flex-col gap-2">
          {standings.map((row) => {
            const up = row.returnPercent >= 0;
            /*
              Where a row sits in the ladder, shown on the row itself rather
              than as a line drawn across the table: a border between two rows
              is invisible on a phone, and this is the one thing somebody
              opens the pod to find out.
            */
            const zone = podZone(row.rank, standings.length, moving);

            const Icon =
              zone === "promoted" ? ArrowUp : zone === "relegated" ? ArrowDown : Minus;

            return (
              <div
                key={row.userId}
                className={cn(
                  "glass-well flex min-h-14 items-center gap-3 rounded-lg px-4 py-2",
                  row.isYou ? "ring-1 ring-primary/40" : null
                )}
              >
                <span className="figure w-6 shrink-0 text-sm text-muted-foreground">
                  {row.rank}
                </span>

                <Icon
                  className={cn(
                    "size-3.5 shrink-0",
                    zone === "promoted"
                      ? "text-gain"
                      : zone === "relegated"
                        ? "text-loss"
                        : "text-muted-foreground/50"
                  )}
                  aria-label={
                    zone === "promoted"
                      ? "Going up"
                      : zone === "relegated"
                        ? "Going down"
                        : "Staying"
                  }
                />

                <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-medium text-muted-foreground">
                  {initials(row.displayName)}
                </span>

                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium">
                    {row.displayName}
                    {row.isYou ? (
                      <span className="ml-2 text-xs text-primary">You</span>
                    ) : null}
                  </span>
                  {!row.hasTraded ? (
                    <span className="text-xs text-muted-foreground">
                      Has not traded yet
                    </span>
                  ) : null}
                </span>

                <span
                  className={cn(
                    "figure shrink-0 text-sm font-semibold",
                    up ? "text-gain" : "text-loss"
                  )}
                >
                  {formatPercent(row.returnPercent)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </Panel>
  );
}
