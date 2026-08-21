import "server-only";

import { cache } from "react";
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

const catalogue = cache(async (): Promise<Map<string, RewardRow>> => {
  if (!canWriteGame) return new Map();

  const admin = createAdminClient();
  const { data } = await admin.from("rewards").select("*");

  return new Map(((data ?? []) as RewardRow[]).map((row) => [row.id, row]));
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
