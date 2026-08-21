"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { recordAcceptance } from "@/app/auth/actions";

export type OnboardingState = { error?: string };

const schema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, "Pick a name your friends will recognise.")
    .max(40, "That name is a little long. Keep it under 40 characters."),
  handle: z
    .string()
    .trim()
    .toLowerCase()
    .regex(
      /^[a-z0-9_]{3,20}$/,
      "Use 3 to 20 letters, numbers or underscores, with no spaces."
    ),
});

export async function completeOnboarding(
  _prev: OnboardingState,
  formData: FormData
): Promise<OnboardingState> {
  const parsed = schema.safeParse({
    displayName: formData.get("displayName"),
    handle: formData.get("handle"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/");

  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: parsed.data.displayName,
      handle: parsed.data.handle,
      age_confirmed_at: new Date().toISOString(),
      onboarded_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) {
    // 23505 is a unique violation, which here can only be the handle.
    if (error.code === "23505") {
      return { error: "That name is taken. Try another." };
    }
    return { error: "We could not save that. Try once more." };
  }

  await recordAcceptance();

  revalidatePath("/", "layout");
  redirect("/home");
}
