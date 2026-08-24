"use client";

import { Suspense } from "react";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Coins } from "lucide-react";
import { ArenaWordmark } from "@/components/brand/ArenaWordmark";
import { PAGE } from "@/lib/page-shell";
import { cn } from "@/lib/utils";

const ROOM_TITLES: Record<string, string> = {
  "/home": "Home",
  "/trade": "Trade",
  "/leagues": "Leagues",
  "/season": "Season",
  "/metrics": "Numbers",
  "/plus": "Arena Plus",
  "/profile": "Profile",
};

/*
  Same chrome as Lab, left to right: mark and wordmark, hairline, current room
  title, then Arena Plus. Glass over the field, 3.5rem tall.

  Arena Plus lives here rather than in the dock because the shop is the only
  room somebody arrives at wanting to spend money in, so it is the one room
  that cannot be a scavenger hunt. It was previously reachable from one button
  seven panels down the profile page, which is not reachable at all in any
  sense a player would recognise.

  THE FACE IS NOT HERE ANY MORE. It is the last cell of the dock, which is
  where a person's thumb already is and where every app they use keeps it.
  Two pictures of the same player on one screen is one too many, and the one
  that had to go is the one four inches from the thumb. `aria-label="Your
  profile"` moved with it. Nothing here is personal now, so nothing here waits
  on a session to be read.

  The bar pads itself by the top safe area rather than sitting at a flat
  top: 0. Arena runs as an installed app with a translucent status bar and
  viewport-fit=cover, so on a notched phone the real top of the window is
  above the status bar. Without this the glass stops short of it and the page
  scrolls through the strip above the header.
*/
export function AppHeader() {
  return (
    <header className="glass-bar sticky top-0 z-40 border-b border-border pt-[env(safe-area-inset-top)]">
      <div className={`${PAGE} flex h-14 items-center gap-3`}>
        <Link href="/home" className="rounded-md focus-visible:outline-none">
          <ArenaWordmark />
          <span className="sr-only">Upside Arena home</span>
        </Link>

        <span className="hidden h-5 w-px bg-border sm:block" aria-hidden="true" />

        {/*
          The room's name and whether the shop is the room you are in are both
          read off the URL, and one shell is prerendered for every room, so
          they wait. On a tap between rooms the router already holds the new
          path and this resolves in the same frame; only a cold arrival sees
          the fallback, and the fallback is the same bar at the same height.
        */}
        <Suspense fallback={<RoomName room={null} />}>
          <CurrentRoomName />
        </Suspense>

        <div className="ml-auto flex items-center gap-2">
          <Suspense fallback={<PlusLink onPlus={false} />}>
            <CurrentPlusLink />
          </Suspense>
        </div>
      </div>
    </header>
  );
}

function CurrentRoomName() {
  const pathname = usePathname();
  const room = pathname.startsWith("/leagues/")
    ? "League"
    : (ROOM_TITLES[pathname] ?? "Arena");

  return <RoomName room={room} />;
}

function RoomName({ room }: { room: string | null }) {
  return (
    <span className="hidden text-sm text-muted-foreground sm:block">
      {room ?? "\u00a0"}
    </span>
  );
}

function CurrentPlusLink() {
  return <PlusLink onPlus={usePathname() === "/plus"} />;
}

function PlusLink({ onPlus }: { onPlus: boolean }) {
  return (
    <Link
      href="/plus"
      aria-current={onPlus ? "page" : undefined}
      aria-label="Arena Plus and the coin shop"
      className={cn(
        "flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-colors",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        onPlus
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground ring-1 ring-foreground/20 hover:bg-accent hover:text-foreground"
      )}
    >
      <Coins className="size-4" aria-hidden="true" />
      <span>Plus</span>
    </Link>
  );
}
