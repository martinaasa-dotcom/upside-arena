import { cacheLife, cacheTag, updateTag } from "next/cache";

/*
  What a room is allowed to know before the tap.

  Every room here reads live data, and until now every one of those reads
  happened after the tap: the frame arrived, then the figures streamed into it
  one region at a time. That is a second of a page assembling itself in front
  of somebody, and it is the difference between an app that feels made and one
  that feels like it is still thinking.

  A read that is cached with a long enough stale time is carried in the App
  Shell -- the thing a link prefetches -- so the room arrives already holding
  its numbers and there is nothing left to stream. That is the whole of what
  this file is for.

  The numbers below are not taste. Five minutes of stale is the threshold the
  framework uses to decide whether a cached value may ride in the shell at
  all; under it the value is still cached and the round trip is still saved,
  but it lands after the tap rather than before it, which is the only thing
  anybody notices. An expire under five minutes disqualifies it too. So both
  are set where they have to be, and `revalidate` is the one free choice:
  a minute, so the server quietly refreshes behind readers.

  Nothing here waits five minutes to be true. Every entry carries the tag of
  the player it belongs to, and everything that changes a player's week drops
  that tag -- a trade, a league joined, a goal declared, a name changed. Time
  is the backstop, not the mechanism.
*/
export function playerTag(userId: string) {
  return `player:${userId}`;
}

/** The week itself, which is the same for everybody playing it. */
export const CYCLE_TAG = "cycle";

/**
 * Declares a cached read as one player's, so the shell may carry it and a
 * mutation may drop it. Call at the top of a cached function, nowhere else.
 */
export function playerCache(userId: string) {
  cacheLife({ stale: 300, revalidate: 60, expire: 3600 });
  cacheTag(playerTag(userId));
}

/** The same, for a read that belongs to the week rather than to a player. */
export function cycleCache() {
  cacheLife({ stale: 300, revalidate: 60, expire: 3600 });
  cacheTag(CYCLE_TAG);
}

/**
 * Drops everything cached for one player.
 *
 * Call from any server action that changes their week. revalidatePath does
 * not do this job: it clears the rendered route, not the tagged reads behind
 * it, so a page rebuilt after a trade would be rebuilt from the same cached
 * numbers it had before the trade.
 *
 * updateTag rather than revalidateTag, because in every case here the player
 * is looking at the result of something they just did and should see it on
 * this response rather than the next one.
 */
export function playerChanged(userId: string) {
  updateTag(playerTag(userId));
}

/** The same for a change that belongs to the week rather than to a player. */
export function cycleChanged() {
  updateTag(CYCLE_TAG);
}
