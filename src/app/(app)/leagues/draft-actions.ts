"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  cancelDraft,
  createDraft,
  getDraftState,
  joinDraft,
  leaveDraft,
  makePick,
  runClock,
  startDraft,
  type DraftState,
} from "@/lib/game/draft";
import {
  MAX_SEATS,
  PICK_SECONDS_CHOICES,
  ROUND_CHOICES,
  isDraftableFormatId,
} from "@/lib/game/draft-order";
import { isLengthId } from "@/lib/game/lengths";
import { playerChanged } from "@/lib/game/cache";

/*
  Opening, joining, starting and picking.

  None of them trusts an id from a form. Every check about who may do a thing
  lives in the database function underneath, exactly as the battle actions
  beside this file do it: a draft id is not a secret, and guessing one must not
  be a way to pick a name in somebody else's room.

  The one that is not like the others is pollDraft, which is a read. It is a
  server action rather than a route because it is called on an interval from
  one client component and nothing else, and a route would be a public surface
  to document, guard and keep working for a caller that does not exist.
*/

export type DraftFormState = { error?: string };

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");
  return user;
}

const openSchema = z.object({
  leagueId: z.string().uuid(),
  format: z
    .string()
    .refine(isDraftableFormatId, "Pick a rule book with a board to draft from."),
  length: z.string().refine(isLengthId, "Pick how long it runs for."),
  rounds: z.coerce
    .number()
    .int()
    .refine(
      (value): value is (typeof ROUND_CHOICES)[number] =>
        (ROUND_CHOICES as readonly number[]).includes(value),
      "Pick how many names each."
    ),
  pickSeconds: z.coerce
    .number()
    .int()
    .refine(
      (value): value is (typeof PICK_SECONDS_CHOICES)[number] =>
        (PICK_SECONDS_CHOICES as readonly number[]).includes(value),
      "Pick how long a turn lasts."
    ),
});

export async function submitOpenDraft(
  _prev: DraftFormState,
  formData: FormData
): Promise<DraftFormState> {
  const user = await requireUser();

  const parsed = openSchema.safeParse({
    leagueId: formData.get("leagueId"),
    format: formData.get("format"),
    length: formData.get("length"),
    rounds: formData.get("rounds"),
    pickSeconds: formData.get("pickSeconds"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  }

  const result = await createDraft(
    user.id,
    parsed.data.leagueId,
    parsed.data.format,
    parsed.data.length,
    parsed.data.rounds,
    parsed.data.pickSeconds
  );

  if (!result.ok) return { error: result.error };

  playerChanged(user.id);
  revalidatePath("/leagues", "layout");
  revalidatePath("/home");
  redirect(`/leagues/${parsed.data.leagueId}/draft`);
}

export async function submitJoinDraft(formData: FormData) {
  const user = await requireUser();
  const draftId = String(formData.get("draftId") ?? "");
  if (!draftId) return;

  await joinDraft(user.id, draftId);

  playerChanged(user.id);
  revalidatePath("/leagues", "layout");
}

export async function submitLeaveDraft(formData: FormData) {
  const user = await requireUser();
  const draftId = String(formData.get("draftId") ?? "");
  if (!draftId) return;

  await leaveDraft(user.id, draftId);

  playerChanged(user.id);
  revalidatePath("/leagues", "layout");
}

export async function submitStartDraft(
  _prev: DraftFormState,
  formData: FormData
): Promise<DraftFormState> {
  const user = await requireUser();
  const draftId = String(formData.get("draftId") ?? "");
  if (!draftId) return { error: "We could not find that draft." };

  const result = await startDraft(user.id, draftId);
  if (!result.ok) return { error: result.error };

  playerChanged(user.id);
  revalidatePath("/leagues", "layout");
  return {};
}

export async function submitCancelDraft(formData: FormData) {
  const user = await requireUser();
  const leagueId = String(formData.get("leagueId") ?? "");
  const draftId = String(formData.get("draftId") ?? "");
  if (!leagueId || !draftId) return;

  await cancelDraft(user.id, draftId);

  playerChanged(user.id);
  revalidatePath("/leagues", "layout");
  revalidatePath("/home");
  redirect(`/leagues/${leagueId}`);
}

/**
 * Taking a name.
 *
 * Returns the refusal rather than throwing it, because every refusal here is
 * something a person needs to read: the name has gone, it is not your turn, the
 * draft has finished. A draft where a tap does nothing and says nothing is a
 * draft everybody assumes is broken.
 */
export async function submitPick(
  draftId: string,
  symbol: string
): Promise<DraftFormState> {
  const user = await requireUser();

  const result = await makePick(user.id, draftId, symbol);
  if (!result.ok) return { error: result.error };

  playerChanged(user.id);
  return {};
}

/**
 * The room asking what has happened, every couple of seconds.
 *
 * It also runs the clock, which is why this is not a plain read. There is no
 * scheduler in Arena that ticks every thirty seconds, and adding one for this
 * would be a cron job whose whole purpose is a screen that is already open: the
 * people looking at the draft are the ones who need the turn to move on, and
 * their polls are a better heartbeat than any timer on the server.
 *
 * Safe from five phones at once because clock_pick checks the deadline itself
 * under a lock. The first poll past the deadline moves the draft on and the
 * other four find nothing to do.
 */
export async function pollDraft(draftId: string): Promise<DraftState | null> {
  const user = await requireUser();

  if (await runClock(draftId)) playerChanged(user.id);

  return getDraftState(user.id, draftId);
}

export const DRAFT_MAX_SEATS = MAX_SEATS;
