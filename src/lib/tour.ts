import type { Profile } from "@/lib/types";

/*
  Which walkthrough is current, and therefore who is due one.

  Raise this by one and every account in the database is behind it again, so
  every player -- including the ones who have been here since the first week
  -- gets the new walkthrough on their next visit, once. That is the whole
  mechanism: there is no "reset the tour" script to run and no flag to clear.

  Raise it only when the walkthrough says something materially different.
  Fixing a typo in it and re-interrupting everybody is a worse trade than the
  typo.

  1 -- the first full walkthrough of the rooms (2026-08-23). Replaces a tour
      that did not exist: before it, everything Arena knew how to say about
      itself was on a signed-out page most players never opened.
*/
export const TOUR_VERSION = 1;

/**
 * Whether this player is owed the walkthrough.
 *
 * A missing profile is not owed anything yet -- that is a session still
 * arriving, and interrupting it would put the tour in front of a screen that
 * has not painted. The layout's own gate sends anybody genuinely profileless
 * to onboarding first.
 */
export function needsTour(profile: Profile | null): boolean {
  if (!profile) return false;
  return (profile.tour_version ?? 0) < TOUR_VERSION;
}
