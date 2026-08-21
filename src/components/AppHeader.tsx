"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArenaWordmark } from "@/components/brand/ArenaWordmark";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PAGE } from "@/lib/page-shell";
import { initials } from "@/lib/format";
import type { Profile } from "@/lib/types";

const ROOM_TITLES: Record<string, string> = {
  "/home": "Home",
  "/trade": "Trade",
  "/leagues": "Leagues",
  "/metrics": "Numbers",
  "/profile": "Profile",
};

/*
  Same chrome as Lab, left to right: mark and wordmark, hairline, current room
  title, then the account avatar. Glass over the field, 3.5rem tall.
*/
export function AppHeader({ profile }: { profile: Profile | null }) {
  const pathname = usePathname();
  const room = pathname.startsWith("/leagues/")
    ? "League"
    : (ROOM_TITLES[pathname] ?? "Arena");
  const name = profile?.display_name ?? "Player";

  return (
    <header className="sticky top-0 z-40 h-14 border-b border-border bg-background/75 backdrop-blur-xl">
      <div className={`${PAGE} flex h-14 items-center gap-3`}>
        <Link href="/home" className="rounded-md focus-visible:outline-none">
          <ArenaWordmark />
          <span className="sr-only">Upside Arena home</span>
        </Link>

        <span className="hidden h-5 w-px bg-border sm:block" aria-hidden="true" />
        <span className="hidden text-sm text-muted-foreground sm:block">{room}</span>

        <div className="ml-auto flex items-center gap-2">
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
