"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createLeague, joinLeague, leaveLeague } from "@/lib/game/leagues";
import { LEAGUE_ICONS } from "@/lib/game";

export type LeagueState = { error?: string };

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");
  return user;
}

const createSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Give your league a name.")
    .max(40, "That name is a little long. Keep it under 40 characters."),
  // Only an icon from the set. A free text field here would be a way to put
  // arbitrary characters on a page other people read.
  icon: z
    .string()
    .trim()
    .refine((value) => value === "" || (LEAGUE_ICONS as readonly string[]).includes(value), {
      message: "Pick one of the icons.",
    })
    .optional(),
});

export async function submitCreateLeague(
  _prev: LeagueState,
  formData: FormData
): Promise<LeagueState> {
  const user = await requireUser();

  const parsed = createSchema.safeParse({
    name: formData.get("name"),
    icon: formData.get("icon") ?? "",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  }

  const result = await createLeague(
    user.id,
    parsed.data.name,
    parsed.data.icon || null
  );

  if (!result.ok) return { error: result.error };

  revalidatePath("/leagues");
  redirect(`/leagues/${result.league.id}`);
}

const joinSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{8}$/, "An invite code is eight letters and numbers."),
});

export async function submitJoinLeague(
  _prev: LeagueState,
  formData: FormData
): Promise<LeagueState> {
  const user = await requireUser();

  const parsed = joinSchema.safeParse({ code: formData.get("code") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the code and try again." };
  }

  const result = await joinLeague(user.id, parsed.data.code);
  if (!result.ok) return { error: result.error };

  revalidatePath("/leagues");
  redirect(`/leagues/${result.league.id}`);
}

export async function submitLeaveLeague(formData: FormData) {
  const user = await requireUser();
  const leagueId = String(formData.get("leagueId") ?? "");

  if (!leagueId) return;

  await leaveLeague(user.id, leagueId);
  revalidatePath("/leagues");
  redirect("/leagues");
}
