import * as React from "react";
import { cn } from "@/lib/utils";

/*
  A placeholder for one thing that is on its way, and only that.

  There used to be a whole-room version of this, and a loading.tsx above every
  room that drew it. That was right when it was written: no room could be
  prerendered, and a route that cannot be prerendered was not prefetched at
  all unless it had a loading boundary, so the grey room was the only thing
  standing between a tap and no feedback whatsoever.

  Cache Components made rooms prerenderable and the rooms were rewritten to
  suit -- a real frame with real headings, and each figure streaming into its
  own place. The grey room outlived the problem it solved and became the
  problem: a loading.tsx sits above the page, so on every tap between rooms
  React threw away the frame that was already in the browser and drew the
  skeleton instead. The room could not paint until the server answered,
  whatever the room had been rewritten to do.

  So the rule is the shape of the boundary. Fallbacks belong inside a page,
  around the one part that is genuinely waiting, next to the parts that are
  not. A fallback that covers a whole route can only hide a route that had
  something to show.

  This is what is left: one grey bar, for a field or a line, close to the
  thing it stands in for.
*/
export function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-foreground/10", className)}
      {...props}
    />
  );
}
