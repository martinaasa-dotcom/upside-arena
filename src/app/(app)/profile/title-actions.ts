"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { equipTitle } from "@/lib/game/streaks";

export async function submitEquipTitle(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/");

  // An empty value means taking the title off, which is always allowed.
  const raw = String(formData.get("rewardId") ?? "");
  await equipTitle(user.id, raw === "" ? null : raw);

  revalidatePath("/profile");
  revalidatePath("/leagues");
}
