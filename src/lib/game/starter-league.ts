/*
  What to call the league somebody is given on their first visit.

  Section 4 wants a new player to land in a league rather than on an empty
  screen. Naming it after them matters more than it sounds: it is theirs to
  invite people into, and a name that was the same for everybody would read as
  a placeholder rather than as something they own.
*/

/** The league name column holds forty characters. */
const MAX_LENGTH = 40;

export function starterLeagueName(displayName: string): string {
  const name = displayName.trim().replace(/\s+/g, " ");
  if (!name) return "My league";

  /*
    A name already ending in s takes the bare apostrophe, so a player called
    Chris gets "Chris' league" rather than "Chris's league". Both are defensible
    English; the point is picking one and not producing "Chriss' league".
  */
  const possessive = /s$/i.test(name) ? `${name}'` : `${name}'s`;
  const full = `${possessive} league`;

  // Rather than truncate somebody's name into something odd looking.
  return full.length <= MAX_LENGTH ? full : "My league";
}
