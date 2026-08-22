"use server";

import { redirect } from "next/navigation";
import { createLeague } from "@/lib/game/leagues";
import { starterLeagueName } from "@/lib/game/starter-league";
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

  /*
    The agreement first, and only then the account that stands on it.

    This was the other way round, with the answer thrown away, so a write that
    failed left somebody marked onboarded with nothing recording what they had
    agreed to — and the only place that shows up is an account export, months
    later, saying we hold no acceptance for a person who gave one.

    In this order the record cannot be missing from an onboarded account.
    Recording it and then failing to save the profile is the harmless way
    round: the acceptance is unique on account, document and version, so
    trying again writes nothing new.
  */
  if (!(await recordAcceptance())) {
    return { error: "We could not save that. Try once more." };
  }

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

  /*
    A league of their own, made for them.

    Section 4 wants somebody to land in a league rather than arrive at an
    empty screen, and every step between signing up and the first live number
    is somewhere to lose them. Making it here costs them nothing and hands
    them an invite code on their first visit, which is the only thing they
    have to give a friend.

    Failing is not fatal. They can make one themselves on the leagues screen,
    and a league that did not get created must never be the reason somebody
    cannot finish signing up.
  */
  try {
    await createLeague(user.id, starterLeagueName(parsed.data.displayName), null);
  } catch {
    // Nothing to recover. They are onboarded either way.
  }

  revalidatePath("/", "layout");
  redirect("/home");
}
