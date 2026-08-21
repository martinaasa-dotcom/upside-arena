"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured, siteUrl } from "@/lib/env";
import { PRIVACY_VERSION, TERMS_VERSION } from "@/lib/legal";
import { safeNext } from "@/lib/redirects";

export type AuthState = { error?: string; sent?: boolean };

const signInSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter an email address we can reach you at."),
  next: z.string().optional(),
});

export async function signInWithEmail(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  if (!isSupabaseConfigured) {
    return { error: "Sign-in is not connected yet. Add your Supabase keys to .env.local." };
  }

  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    next: formData.get("next") ?? undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  }

  const supabase = await createClient();
  const next = safeNext(parsed.data.next);

  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: {
      emailRedirectTo: `${siteUrl()}/auth/confirm?next=${encodeURIComponent(next)}`,
      data: {
        age_confirmed: true,
        terms_version: TERMS_VERSION,
        privacy_version: PRIVACY_VERSION,
      },
    },
  });

  if (error) {
    // Supabase rate-limits link requests per address. Say so plainly.
    return { error: error.message };
  }

  return { sent: true };
}

export async function signInWithGoogle(formData: FormData) {
  if (!isSupabaseConfigured) {
    redirect("/auth/error?reason=not-configured");
  }

  const supabase = await createClient();
  const next = safeNext(formData.get("next")?.toString());

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${siteUrl()}/auth/callback?next=${encodeURIComponent(next)}`,
      queryParams: { prompt: "select_account" },
    },
  });

  if (error || !data.url) {
    redirect("/auth/error?reason=oauth");
  }

  redirect(data.url);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

/**
 * Records that the signed-in account agreed to the current documents. Called
 * once at the end of onboarding, and again whenever a version is bumped.
 */
export async function recordAcceptance() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  await supabase.from("terms_acceptances").upsert(
    [
      { user_id: user.id, document: "terms", version: TERMS_VERSION },
      { user_id: user.id, document: "privacy", version: PRIVACY_VERSION },
    ],
    { onConflict: "user_id,document,version", ignoreDuplicates: true }
  );
}
