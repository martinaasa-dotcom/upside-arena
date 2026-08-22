"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeftRight, CalendarRange, Home, Trophy, User } from "lucide-react";
import { cn } from "@/lib/utils";

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

const ROOMS = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/trade", label: "Trade", icon: ArrowLeftRight },
  { href: "/leagues", label: "Leagues", icon: Trophy },
  { href: "/season", label: "Season", icon: CalendarRange },
  { href: "/profile", label: "Profile", icon: User },
];

/*
  A tap has to be answered on the frame it lands on.

  Every room reads live data, so the answer to a tap comes from the server, and
  until it arrives the pathname has not changed and no tab looks any different.
  That is the whole of what "the dock feels slow" was: the tab you pressed
  carried on looking unpressed while a request was in flight, so the app read
  as having ignored you rather than as having been asked something hard.

  Every room now has a loading boundary, so the pressed tab usually becomes the
  real active tab within a frame or two. This covers what is left: a cold
  prefetch, a slow connection, a tab pressed twice.

  It is drawn as a fill behind the tab rather than as a change to the tab, so
  it costs no layout and cannot move the row under a thumb. It is deliberately
  not the aqua pill and does not touch aria-current: this says "heard you", not
  "you are here", and a navigation that is interrupted or abandoned must not
  leave the dock claiming somewhere you never went.
*/
function PressedFill() {
  const { pending } = useLinkStatus();

  return (
    <span
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 rounded-lg bg-foreground/10 transition-opacity duration-150",
        pending ? "opacity-100" : "opacity-0"
      )}
    />
  );
}

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
                "relative flex h-11 items-center gap-2 rounded-lg px-4 text-sm font-medium transition-colors",
                "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              {active ? null : <PressedFill />}
              <Icon className="relative size-4" aria-hidden="true" />
              <span className={cn("relative", LABELS_FIT)}>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
