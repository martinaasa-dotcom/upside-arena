"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured, siteUrl } from "@/lib/env";
import { authorizeUrl, googleConfigured } from "@/lib/auth/google";
import {
  STATE_COOKIE,
  STATE_MAX_AGE_SECONDS,
  stateFor,
} from "@/lib/auth/google-state";
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

/**
 * Starts Google sign-in, on Arena's own domain.
 *
 * Deliberately not `signInWithOAuth`, which would send the browser to
 * Supabase's callback and make Google name the app after a hostname nobody
 * recognises. See src/lib/auth/google.ts for why that matters and what this
 * costs instead.
 */
export async function signInWithGoogle(formData: FormData) {
  if (!isSupabaseConfigured || !googleConfigured) {
    redirect("/auth/error?reason=not-configured");
  }

  const next = safeNext(formData.get("next")?.toString());
  const state = stateFor(next);

  /*
    The half of the state that stays with the browser. Http-only so no script
    can read it, and short lived because a sign-in somebody wandered away from
    should not still be answerable an hour later.
  */
  const jar = await cookies();
  jar.set(STATE_COOKIE, state.cookie, {
    httpOnly: true,
    sameSite: "lax",
    secure: siteUrl().startsWith("https://"),
    path: "/auth/google",
    maxAge: STATE_MAX_AGE_SECONDS,
  });

  redirect(authorizeUrl(state.param));
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
