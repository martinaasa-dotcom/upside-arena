import { ArrowLeftRight, Home, Trophy, User } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type Room = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Drawn as the player's own face rather than as a glyph. */
  me?: boolean;
};

/*
  The rooms, in the order the dock shows them.

  This is the dock's tabs and nothing else. It is deliberately not the list
  of routes that have a dock under them: the dock is rendered by (app)/layout,
  so it is on every room in that group, including Arena Plus and Numbers,
  which have no tab. Anything needing to know whether a dock is on screen
  asks the dock -- see [data-dock] in BottomDock and .consent-notice in
  globals.css. Reading it off this list is how the measurement notice came to
  cover the navigation on exactly those two rooms.

  SEASON IS NOT HERE, AND THAT IS THE POINT. A bar is quiet because it holds
  few things, not because the things in it are drawn small, and the season is
  the one room that cannot change between Monday and Friday: every figure in
  it was settled on a Friday and has not been touched since. That is a record
  rather than a room, it lives with the rest of a player's record on Profile,
  and /profile has linked to it since long before it left the dock. Taking it
  out also takes the calendar glyph away from the trophy, which was the one
  pair somebody could genuinely mix up on a bar with no words on it.

  `me` marks the cell that is a person rather than a glyph. The dock draws
  the player's own avatar there, which is why the header no longer does.
*/
export const ROOMS: readonly Room[] = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/trade", label: "Trade", icon: ArrowLeftRight },
  { href: "/leagues", label: "Leagues", icon: Trophy },
  { href: "/profile", label: "Profile", icon: User, me: true },
];
