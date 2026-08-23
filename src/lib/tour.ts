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
 *
 * ## Zero and undefined are different answers
 *
 * `0` is a row that has the column and has never finished a walkthrough: owed
 * one. `undefined` is a row read from a database where the column does not
 * exist yet, because `readProfile` selects `*` and simply gets no such key.
 * Those must not be the same answer.
 *
 * docs/DEPLOY.md is explicit that deploying does not apply migrations and that
 * every feature after `0010` degrades rather than breaks. Treating `undefined`
 * as `0` would make this the exception: the tour would open for everybody,
 * `finishTour` would fail on the same missing column, and it would open again
 * on the very next room -- on every page load, for every player, until
 * somebody noticed and ran the SQL. So a database that has never heard of the
 * walkthrough gets no walkthrough, which is exactly the old behaviour, and the
 * migration is what switches it on.
 */
export function needsTour(profile: Profile | null): boolean {
  if (!profile) return false;
  if (profile.tour_version === undefined || profile.tour_version === null) {
    return false;
  }
  return profile.tour_version < TOUR_VERSION;
}
