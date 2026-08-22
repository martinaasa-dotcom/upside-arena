import * as React from "react";
import { cn } from "@/lib/utils";
import { BOX, PAGE, SCORE_CELL, STACK } from "@/lib/page-shell";

/*
  What a room looks like in the moment between the tap and the numbers.

  Every room here reads live data, so none of them can be prerendered, and a
  route that cannot be prerendered is not prefetched at all unless it has a
  loading boundary. Without one, tapping a dock tab does nothing visible until
  the server has finished: the tap lands, and the app appears to have ignored
  it. With one, the shell is already in the browser before the tap, the new
  room paints on the same frame, and the figures stream into these boxes.

  So these are not decoration. They are the thing that makes the dock feel
  connected to the screen.

  The shapes are deliberately the same shapes the real room uses: same panel,
  same score cell, same gaps. A placeholder that is a different size to what
  replaces it moves the page under somebody's thumb.
*/

export function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-foreground/10", className)}
      {...props}
    />
  );
}

/** A whole room's worth of placeholder, in the page frame the room uses. */
export function RoomSkeleton({
  /* Width of the title bar, so a short title does not get a long grey slab. */
  title = "w-40",
  scores = 0,
  /* One number per panel: how many lines of body it stands in for. */
  panels = [3],
}: {
  title?: string;
  scores?: number;
  panels?: number[];
}) {
  return (
    <div className={`${PAGE} ${STACK}`} role="status" aria-busy="true">
      <span className="sr-only">Loading</span>

      <Skeleton className={cn("h-8", title)} />

      {scores > 0 ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: scores }, (_, i) => (
            <div key={i} className={cn(SCORE_CELL, "flex flex-col gap-2")}>
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-7 w-20" />
            </div>
          ))}
        </div>
      ) : null}

      {panels.map((rows, i) => (
        <div key={i} className={BOX}>
          <Skeleton className="mb-4 h-5 w-48" />
          <div className="flex flex-col gap-3">
            {Array.from({ length: rows }, (_, row) => (
              <Skeleton key={row} className="h-10 w-full" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
