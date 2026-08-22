"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { ROOMS } from "@/lib/rooms";

/*
  Bottom dock, on desktop and phone alike. Active tab is the aqua pill
  with black type. Rooms are added here as later phases land, never before the
  room exists: a dead tab is worse than a short dock.

  The labels hide below LABELS_FIT rather than below a stock breakpoint,
  because what decides whether they fit is the width the row actually needs,
  and that changes every time a room is added. Measured with the labels on:
  five cells come to 526px, so anything narrower has to drop to icons or the
  dock runs off the side of the screen. A fifth room is what pushed it past
  the 30rem it used to hide at, which nothing caught because a dock that
  overflows still renders. Re-measure when a sixth lands.
*/
const LABELS_FIT = "max-[544px]:sr-only";


export function BottomDock() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Rooms"
      className="fixed inset-x-0 bottom-0 z-40 flex justify-center pb-[max(1rem,env(safe-area-inset-bottom))]"
    >
      <div className="card-sheen glass flex items-center gap-1 rounded-xl p-1 ring-1 ring-foreground/20">
        {ROOMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex h-11 items-center gap-2 rounded-lg px-4 text-sm font-medium transition-colors",
                "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              <Icon className="size-4" aria-hidden="true" />
              <span className={LABELS_FIT}>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
