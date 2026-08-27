"use client";

import { Suspense } from "react";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Coins } from "lucide-react";
import { BrandBar } from "@/components/BrandBar";
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
  title, then Arena Plus. Glass over the field, 3.5rem tall. The bar itself
  lives in BrandBar so onboarding cannot drift from it.

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
*/
export function AppHeader() {
  return (
    <BrandBar href="/home">
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
    </BrandBar>
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
