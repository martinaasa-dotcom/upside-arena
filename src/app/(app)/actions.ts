"use server";

import { updateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { sessionTag } from "@/lib/profile";
import { TOUR_VERSION } from "@/lib/tour";

/*
  Writing down that somebody has seen the walkthrough, and putting it back.

  Both are the same one-column update, and both drop the session tag
  afterwards for the same reason completeOnboarding does: every room asks a
  cached profile whether the tour is owed, and without the drop the answer
  stays "yes" for as long as the entry lives -- which is a walkthrough that
  reappears on the next room after somebody has just finished it.
*/

async function setTourVersion(version: number): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return false;

  const { error } = await supabase
    .from("profiles")
    .update({ tour_version: version })
    .eq("id", user.id);

  if (error) return false;

  updateTag(sessionTag(user.id));
  return true;
}

/**
 * They have read it, or decided not to. Both are answers, and neither is a
 * reason to ask again tomorrow: a walkthrough that reappears because somebody
 * closed it is not a walkthrough, it is a nag.
 */
export async function finishTour(): Promise<{ ok: boolean }> {
  return { ok: await setTourVersion(TOUR_VERSION) };
}

/** Ask for it again from the profile screen. Zero is "has never seen one". */
export async function replayTour(): Promise<{ ok: boolean }> {
  return { ok: await setTourVersion(0) };
}
