"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { equipCosmetic } from "@/lib/game/streaks";
import type { CosmeticSlot } from "@/lib/supabase/database.types";

const SLOTS: CosmeticSlot[] = ["title", "flair", "theme"];

/**
 * Putting a cosmetic on, or taking it off.
 *
 * The slot comes from the form, so it is checked against the list here rather
 * than trusted. The database checks ownership and that the item belongs in
 * that slot as well; this is the cheap refusal before the round trip.
 */
export async function submitEquip(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/");

  const slot = String(formData.get("slot") ?? "") as CosmeticSlot;
  if (!SLOTS.includes(slot)) return;

  // An empty value means taking it off, which is always allowed.
  const raw = String(formData.get("rewardId") ?? "");
  await equipCosmetic(user.id, raw === "" ? null : raw, slot);

  revalidatePath("/profile");
  revalidatePath("/home");
  revalidatePath("/leagues");
}
