"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { clearOrder, queueOrder } from "@/lib/game/lineup";
import { lineupMonday } from "@/lib/market/session";
import { playerChanged } from "@/lib/game/cache";

/*
  Building a lineup for a Monday that has not happened yet.

  The week is never taken from the form. A lineup fills at a particular
  Monday's opening price, so a form that could name its own Monday would be a
  form that could name one whose opening price is already known -- which is the
  single thing this feature must never allow. It is worked out here, from the
  New York clock, exactly as the goal actions resolve the week rather than
  accepting one.
*/

export type LineupState = { error?: string; success?: string };

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");
  return user;
}

const queueSchema = z.object({
  symbol: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9.\-]{1,12}$/, "Pick a company from the list."),
  quantity: z.coerce
    .number()
    .int("Enter a whole number of shares.")
    .positive("Enter how many shares you want.")
    .max(1_000_000, "That is more shares than this game allows."),
});

export async function submitLineupOrder(
  _prev: LineupState,
  formData: FormData
): Promise<LineupState> {
  const user = await requireUser();

  const parsed = queueSchema.safeParse({
    symbol: formData.get("symbol"),
    quantity: formData.get("quantity"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  }

  const monday = lineupMonday();
  const result = await queueOrder(
    user.id,
    monday,
    parsed.data.symbol,
    parsed.data.quantity
  );

  if (!result.ok) return { error: result.error };

  playerChanged(user.id);
  revalidatePath("/trade");
  playerChanged(user.id);
  revalidatePath("/home");

  return {
    success: `${parsed.data.quantity} ${parsed.data.symbol} lined up for Monday.`,
  };
}

/**
 * Taking one out of the lineup.
 *
 * Returns what happened rather than swallowing it. Until the lock was moved
 * into the database it could not fail -- p_locked was false for every order
 * ever passed -- so a form that ignored the answer looked harmless. Now a
 * refusal is reachable: somebody with the page still open from before Monday's
 * bell taps Remove, the week is set, and nothing happens. Being told no is
 * fine; being told nothing is not.
 */
export async function submitClearLineupOrder(
  orderId: string
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser();

  if (!orderId) return { ok: false, error: "We could not find that order." };

  const result = await clearOrder(user.id, orderId);
  if (!result.ok) return { ok: false, error: result.error };

  playerChanged(user.id);
  revalidatePath("/trade");
  playerChanged(user.id);
  revalidatePath("/home");

  return { ok: true };
}
