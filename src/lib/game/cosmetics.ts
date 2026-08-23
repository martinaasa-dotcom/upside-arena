import "server-only";

import { cache } from "react";
import { cacheLife } from "next/cache";
import { canWriteGame } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import type { RewardRow } from "@/lib/supabase/database.types";

/*
  Turning an equipped reward id into the key the app draws with.

  The catalogue is fixed content, so it is read once per request and shared.
  The style key is looked up rather than parsed out of the id, because an id
  is an identifier and a rendering instruction is a rendering instruction, and
  conflating them is how a rename becomes a visual bug.
*/

/*
  Fixed content, so read like fixed content.

  "Once per request" was the shape of this for as long as a request was the
  longest anything lived. It is a table of rewards that changes when the game
  gains a new one and not otherwise, and it is the same table for every player
  in it, so a per-request read meant fetching identical rows again on every
  single screen for anybody wearing anything.

  An hour, and refreshed behind the reader, because the cost of being an hour
  behind on a new reward is that it appears an hour late and the cost of
  asking every time is a database round trip between a tap and the header.

  A Map does not survive being cached -- what comes back is what can be
  serialised -- so the entries are cached and the Map is built from them.
  Returning a Map from here and finding an empty one at the other end is the
  quiet version of this being wrong, and it would have looked like every
  player owning nothing.
*/
async function catalogueEntries(): Promise<[string, RewardRow][]> {
  "use cache";
  cacheLife({ stale: 3600, revalidate: 3600, expire: 86_400 });

  if (!canWriteGame) return [];

  const admin = createAdminClient();
  const { data } = await admin.from("rewards").select("*");

  return ((data ?? []) as RewardRow[]).map((row) => [row.id, row]);
}

/** Shared within a render as well, so one screen builds the Map once. */
const catalogue = cache(async (): Promise<Map<string, RewardRow>> => {
  return new Map(await catalogueEntries());
});

async function styleKeyFor(rewardId: string | null, kind: string) {
  if (!rewardId) return null;

  const row = (await catalogue()).get(rewardId);
  // Wrong kind means somebody's profile is in a state the trigger should have
  // prevented. Draw nothing rather than draw it in the wrong place.
  if (!row || row.kind !== kind) return null;

  return row.style_key;
}

export function themeStyleKey(rewardId: string | null) {
  return styleKeyFor(rewardId, "theme");
}

export function flairStyleKey(rewardId: string | null) {
  return styleKeyFor(rewardId, "flair");
}

/** The name of a worn title, for the places that print it. */
export async function titleName(rewardId: string | null) {
  if (!rewardId) return null;
  const row = (await catalogue()).get(rewardId);
  return row && row.kind === "title" ? row.name : null;
}
