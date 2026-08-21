"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeftRight, Home, User } from "lucide-react";
import { cn } from "@/lib/utils";

/*
  Bottom dock, on desktop and phone alike. Active tab is the warm-yellow pill
  with black type. Rooms are added here as later phases land, never before the
  room exists: a dead tab is worse than a short dock.
*/
const ROOMS = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/trade", label: "Trade", icon: ArrowLeftRight },
  { href: "/profile", label: "Profile", icon: User },
];

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
              <span className="max-xs:sr-only">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
