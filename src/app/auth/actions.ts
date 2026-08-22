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
import { readEmail } from "@/lib/auth/email-address";
import { domainAcceptsMail } from "@/lib/auth/email-mx";

export type AuthState = {
  error?: string;
  sent?: boolean;
  /*
    A spelling worth asking about before anything is sent, and the address as
    it was typed, so the form can offer both and correct nobody by surprise.
  */
  suggestion?: string;
  typed?: string;
};

const signInSchema = z.object({
  email: z.string(),
  next: z.string().optional(),
  /** Set once the person has answered a "did you mean" question about their own address. */
  confirmed: z.string().optional(),
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
    confirmed: formData.get("confirmed") ?? undefined,
  });

  if (!parsed.success) {
    return { error: "Check the form and try again." };
  }

  /*
    Everything about the address is settled before a single message is asked
    for. A magic link is the only mail Arena sends to a stranger, so an address
    that cannot receive is not a smaller success: it is a bounce against the
    project's sending reputation and a person sitting in front of an empty
    inbox believing the app is broken.
  */
  const verdict = readEmail(parsed.data.email);

  if (verdict.kind === "unreachable") {
    return { error: verdict.message, typed: verdict.email };
  }

  /*
    One edit from a domain half the world uses. Asked rather than assumed, and
    the typed spelling stays on offer, because plenty of real domains sit one
    letter from a famous one and being told your own address is wrong is worse
    than a bounce.
  */
  if (verdict.kind === "check" && parsed.data.confirmed !== "1") {
    return { suggestion: verdict.suggestion, typed: verdict.email };
  }

  const email = verdict.email;
  const domain = email.slice(email.lastIndexOf("@") + 1);

  if (!(await domainAcceptsMail(domain))) {
    return {
      error: `We could not find a mail server for ${domain}, so a link sent there would not arrive. Check the spelling.`,
      typed: email,
    };
  }

  const supabase = await createClient();
  const next = safeNext(parsed.data.next);

  const { error } = await supabase.auth.signInWithOtp({
    email,
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
/**
 * Writes down which documents this account agreed to, and says whether it
 * worked.
 *
 * It used to throw the answer away. That table is the only durable record that
 * anybody accepted anything — it is what an account export returns when
 * somebody asks what we hold on them — so a write that quietly did not happen
 * left a player who had agreed to the terms with nothing saying so, and no
 * way for anyone to find out.
 *
 * Safe to call again: the rows are unique on account, document and version,
 * and a repeat is ignored rather than duplicated.
 */
export async function recordAcceptance(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return false;

  const { error } = await supabase.from("terms_acceptances").upsert(
    [
      { user_id: user.id, document: "terms", version: TERMS_VERSION },
      { user_id: user.id, document: "privacy", version: PRIVACY_VERSION },
    ],
    { onConflict: "user_id,document,version", ignoreDuplicates: true }
  );

  if (error) {
    console.error("terms acceptance not recorded", error);
    return false;
  }

  return true;
}
