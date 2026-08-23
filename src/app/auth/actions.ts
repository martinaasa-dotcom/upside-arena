"use server";

import { redirect } from "next/navigation";
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

/*
  Google is the only way in.

  `signInWithEmail` lived here and sent a magic link. Everything it did was in
  service of getting an address right that Google already has right: a syntax
  read, a "did you mean gmail.com" question, an MX lookup against the domain,
  and a rate limit to sit behind. Every one of those is a way for somebody to
  fail to get into their own account, and none of them exist on an ID token.

  What it recorded that this does not is `age_confirmed` and the two document
  versions in Supabase user metadata. That is not a loss: the durable record
  of who agreed to what is the `terms_acceptances` table, written by
  `recordAcceptance` at the end of onboarding for everybody however they
  signed in, and it is what an account export returns.
*/

/**
 * Starts Google sign-in, on Arena's own domain.
 *
 * Deliberately not `signInWithOAuth`, which would send the browser to
 * Supabase's callback and make Google name the app after a hostname nobody
 * recognises. See src/lib/auth/google.ts for why that matters and what this
 * costs instead.
 */
export async function signInWithGoogle(formData: FormData) {
  if (!isSupabaseConfigured || !googleConfigured()) {
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
