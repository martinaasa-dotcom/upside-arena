import * as React from "react";
import { cn } from "@/lib/utils";
import { BOX, PAGE, SCORE_CELL, STACK } from "@/lib/page-shell";

/*
  What a room looks like before its numbers arrive.

  Every shape here is the same size and in the same place as the thing it
  stands in for, which is the whole point. A placeholder that does not match
  makes the page jump when the real content lands, and a page that jumps feels
  slower than one that simply took a moment, however much sooner it painted.

  Nothing here shows a number, not even a greyed-out one. This app's rule is
  that no invented figure is ever on screen, and a fake number behind a pulse
  is still a fake number.
*/

/** One grey shape. Sized by the caller, because only the caller knows. */
export function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("skeleton", className)} {...props} />;
}

/** A number tile, matching Score. */
export function SkeletonScore() {
  return (
    <div className={cn(SCORE_CELL, "flex flex-col gap-2")}>
      <Skeleton className="h-4 w-20" />
      <Skeleton className="h-7 w-28" />
      <Skeleton className="h-4 w-24" />
    </div>
  );
}

/** A row of number tiles, matching Scoreboard. */
export function SkeletonScoreboard({ cells = 4 }: { cells?: number }) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {Array.from({ length: cells }, (_, index) => (
        <SkeletonScore key={index} />
      ))}
    </div>
  );
}

/** A panel with a heading and some body, matching Panel. */
export function SkeletonPanel({
  rows = 3,
  className,
}: {
  rows?: number;
  className?: string;
}) {
  return (
    <div className={cn(BOX, className)}>
      <div className="mb-4 flex flex-col gap-2">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-64 max-w-full" />
      </div>
      <div className="flex flex-col gap-2">
        {Array.from({ length: rows }, (_, index) => (
          <Skeleton key={index} className="h-10 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}

/**
 * The frame every room's placeholder sits in.
 *
 * `aria-busy` rather than a live region: a screen reader should know the page
 * is still working without having a pile of meaningless shapes read out.
 */
export function SkeletonPage({
  title = "w-40",
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`${PAGE} ${STACK}`} aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading</span>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Skeleton className={cn("h-8", title)} />
        <Skeleton className="h-6 w-28 rounded-full" />
      </div>
      {children}
    </div>
  );
}
