"use server";

import { createClient } from "@/lib/supabase/server";
import { recordHandoffOutcome } from "@/lib/billing/handoff";

/*
  Recording what somebody did about the Upside Lab moment.

  A no is what stops it ever being offered again, so this is the part that
  makes "we will not bring this up again" true rather than a claim.
*/
export async function closeHandoff(
  outcome: "clicked" | "dismissed"
): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false };

  await recordHandoffOutcome(user.id, outcome);
  return { ok: true };
}
