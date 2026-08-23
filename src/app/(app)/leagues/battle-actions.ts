"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { cancelBattle, startBattle } from "@/lib/game/battles";
import { isFormatId } from "@/lib/game/formats";
import { isLengthId } from "@/lib/game/lengths";

/*
  Starting and calling off a battle.

  Both take a league or a battle id from a form, and neither trusts it. Every
  check about who may do this lives in the database function underneath: a
  league id is not a secret, and guessing one must not be a way to start a
  contest inside somebody else's league.
*/

export type BattleState = { error?: string };

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");
  return user;
}

const startSchema = z.object({
  leagueId: z.string().uuid(),
  format: z.string().refine(isFormatId, "Pick one of the formats."),
  length: z.string().refine(isLengthId, "Pick how long it runs for."),
});

export async function submitStartBattle(
  _prev: BattleState,
  formData: FormData
): Promise<BattleState> {
  const user = await requireUser();

  const parsed = startSchema.safeParse({
    leagueId: formData.get("leagueId"),
    format: formData.get("format"),
    length: formData.get("length"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  }

  const result = await startBattle(
    user.id,
    parsed.data.leagueId,
    parsed.data.format,
    parsed.data.length
  );

  if (!result.ok) return { error: result.error };

  revalidatePath("/leagues", "layout");
  revalidatePath("/home");
  redirect(`/leagues/${parsed.data.leagueId}/battle`);
}

export async function submitCancelBattle(formData: FormData) {
  const user = await requireUser();

  const leagueId = String(formData.get("leagueId") ?? "");
  const cycleId = String(formData.get("cycleId") ?? "");
  if (!leagueId || !cycleId) return;

  await cancelBattle(user.id, cycleId);

  revalidatePath("/leagues", "layout");
  revalidatePath("/home");
  redirect(`/leagues/${leagueId}`);
}
