"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { revokeCard, shareLatestWeek } from "@/lib/game/share";
import { shareText } from "@/lib/share/card";

/*
  Making a week shareable, and taking it back.

  Nothing is shared until somebody presses the button. A card is created the
  moment they do, and not before, so a player who never shares anything never
  has a public URL pointing at their result.
*/

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export type ShareResult =
  | { ok: true; url: string; text: string; cardId: string }
  | { ok: false; error: string };

export async function shareMyWeek(): Promise<ShareResult> {
  const user = await requireUser();
  if (!user) return { ok: false, error: "Sign in first." };

  let outcome;
  try {
    outcome = await shareLatestWeek(user.id);
  } catch (error) {
    console.error("share card failed", error);
    return { ok: false, error: "We could not make your card. Try again." };
  }

  if (!outcome.ok) {
    if (outcome.reason === "no_finished_week") {
      return {
        ok: false,
        error:
          "There is no finished week to share yet. Your first one is scored on Friday.",
      };
    }

    // Something actually broke. Said differently, and logged, because telling
    // somebody they have no finished week when they are looking at one is how
    // a real fault goes unnoticed for a month.
    console.error("share card failed", outcome.detail);
    return { ok: false, error: "We could not make your card. Try again." };
  }

  const { card } = outcome;

  revalidatePath("/home");
  revalidatePath("/profile");

  return {
    ok: true,
    url: card.url,
    text: shareText(card.recap, card.url),
    cardId: card.id,
  };
}

export async function unshareCard(cardId: string): Promise<{ ok: boolean }> {
  const user = await requireUser();
  if (!user) return { ok: false };

  const done = await revokeCard(user.id, cardId);

  revalidatePath("/home");
  revalidatePath("/profile");

  return { ok: done };
}
