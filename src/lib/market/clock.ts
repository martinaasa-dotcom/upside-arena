import "server-only";

import { cacheLife } from "next/cache";
import { hasOpenedToday, lineupMonday, nyDate } from "@/lib/market/session";

/*
  The clock, read once and cached, so a room does not have to wait to be drawn.

  Reading the clock is a runtime value under Cache Components, exactly as
  reading a cookie is. A component that calls new Date() cannot be prerendered,
  so it is not in the App Shell a link prefetches, so a tap paints nothing
  where it should be and the room fills in afterwards.

  That is not a theory about this codebase, it is what it was doing. Home read
  the clock twice and Trade once, and Leagues, Season and Profile did not read
  it at all -- which is exactly the split that was reported: two rooms slow,
  three instant. Home's two reads sat below a check for an existing portfolio,
  so a player with no holdings never reached them, which is why every probe
  built against an empty account said the rooms were fine.

  The documented fix for a runtime value that a page genuinely needs is to
  cache it, which is what these do. What is traded is precision at the moment
  a boundary is crossed: the answers below can be up to five minutes behind,
  because five minutes of stale is the threshold for riding in the shell at
  all, and being in the shell is the entire point. So the date can turn over
  five minutes late in New York, and the market can read as not yet open for
  five minutes after the bell. Both are worth a room that arrives whole.
*/

/** Today's date in New York, which is the day a week's bars are counted in. */
export async function today(): Promise<string> {
  "use cache";
  cacheLife({ stale: 300, revalidate: 60, expire: 3600 });
  return nyDate();
}

/** Whether the market has opened yet today, for the bar that can still move. */
export async function marketHasOpened(): Promise<boolean> {
  "use cache";
  cacheLife({ stale: 300, revalidate: 60, expire: 3600 });
  return hasOpenedToday();
}

/** The Monday of the week a lineup is being set for. Changes weekly. */
export async function lineupWeekMonday(): Promise<string> {
  "use cache";
  cacheLife({ stale: 300, revalidate: 60, expire: 3600 });
  return lineupMonday();
}
