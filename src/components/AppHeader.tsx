"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Coins } from "lucide-react";
import { ArenaWordmark } from "@/components/brand/ArenaWordmark";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PAGE } from "@/lib/page-shell";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Profile } from "@/lib/types";

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
  title, then Arena Plus and the account avatar. Glass over the field, 3.5rem
  tall.

  Arena Plus lives here rather than in the dock because the dock is measured to
  the pixel and a sixth room does not fit on a 320px screen; see BottomDock.
  It was previously reachable from one button seven panels down the profile
  page, which is not reachable at all in any sense a player would recognise.
  The shop is the only room somebody arrives at wanting to spend money in, so
  it is the one room that cannot be a scavenger hunt.

  The bar pads itself by the top safe area rather than sitting at a flat
  top: 0. Arena runs as an installed app with a translucent status bar and
  viewport-fit=cover, so on a notched phone the real top of the window is
  above the status bar. Without this the glass stops short of it and the page
  scrolls through the strip above the header.
*/
export function AppHeader({ profile }: { profile: Profile | null }) {
  const pathname = usePathname();
  const room = pathname.startsWith("/leagues/")
    ? "League"
    : (ROOM_TITLES[pathname] ?? "Arena");
  const name = profile?.display_name ?? "Player";
  const onPlus = pathname === "/plus";

  return (
    <header className="glass-bar sticky top-0 z-40 border-b border-border pt-[env(safe-area-inset-top)]">
      <div className={`${PAGE} flex h-14 items-center gap-3`}>
        <Link href="/home" className="rounded-md focus-visible:outline-none">
          <ArenaWordmark />
          <span className="sr-only">Upside Arena home</span>
        </Link>

        <span className="hidden h-5 w-px bg-border sm:block" aria-hidden="true" />
        <span className="hidden text-sm text-muted-foreground sm:block">{room}</span>

        <div className="ml-auto flex items-center gap-2">
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

          <Link
            href="/profile"
            className="rounded-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            aria-label="Your profile"
          >
            <Avatar>
              {profile?.avatar_url ? (
                <AvatarImage src={profile.avatar_url} alt="" />
              ) : null}
              <AvatarFallback>{initials(name)}</AvatarFallback>
            </Avatar>
          </Link>
        </div>
      </div>
    </header>
  );
}
