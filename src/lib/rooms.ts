import { ArrowLeftRight, CalendarRange, Home, Trophy, User } from "lucide-react";

/*
  The rooms, in the order the dock shows them.

  Here rather than inside the dock because two other things need to know
  which routes have a dock at the bottom of them, and a second list written
  out by hand goes stale the first time a room is added. It already had: the
  consent notice kept clear of the dock on four routes while the dock had
  five, so on the fifth it sat on top of it.
*/
export const ROOMS = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/trade", label: "Trade", icon: ArrowLeftRight },
  { href: "/leagues", label: "Leagues", icon: Trophy },
  { href: "/season", label: "Season", icon: CalendarRange },
  { href: "/profile", label: "Profile", icon: User },
] as const;

/** Whether a path is a room, and so has the dock at the bottom of it. */
export function hasDock(pathname: string): boolean {
  return ROOMS.some(
    (room) => pathname === room.href || pathname.startsWith(`${room.href}/`)
  );
}
