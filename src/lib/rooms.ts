import { ArrowLeftRight, CalendarRange, Home, Trophy, User } from "lucide-react";

/*
  The rooms, in the order the dock shows them.

  This is the dock's tabs and nothing else. It is deliberately not the list
  of routes that have a dock under them: the dock is rendered by (app)/layout,
  so it is on every room in that group, including Arena Plus and Numbers,
  which have no tab. Anything needing to know whether a dock is on screen
  asks the dock -- see [data-dock] in BottomDock and .consent-notice in
  globals.css. Reading it off this list is how the measurement notice came to
  cover the navigation on exactly those two rooms.
*/
export const ROOMS = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/trade", label: "Trade", icon: ArrowLeftRight },
  { href: "/leagues", label: "Leagues", icon: Trophy },
  { href: "/season", label: "Season", icon: CalendarRange },
  { href: "/profile", label: "Profile", icon: User },
] as const;
