import { cache } from "react";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import type { Profile } from "@/lib/types";

/** Who the caller is. Only what a page ever asks for, and both verified. */
export type SessionUser = { id: string; email: string | null };

/*
  Establishing who is asking, in as few round trips as it can be done in.

  getUser() answers by calling the auth server, so the old shape of this
  function was two network hops one after the other: ask who they are, then
  read their profile row. Every signed-in screen paid both before it could
  begin rendering.

  getClaims() answers the same question from the access token itself,
  verifying the signature against the project's published keys. On a project
  signing asymmetrically -- the current default -- that verification is local
  once the key set has been fetched, and the hop disappears. On one still
  signing with a shared secret, or anywhere WebCrypto is missing, the library
  calls the auth server itself before it will believe a single claim, which is
  exactly what happened before. So this is never slower and is usually one
  round trip faster.

  What it is not is a relaxation. The token is still verified before a single
  byte of it is believed: an unsigned or expired token yields no claims and
  the caller is treated as signed out. Reading the cookie and trusting what it
  says would be the insecure version of this, and is not what happens here.
*/
async function identify(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<SessionUser | null> {
  const { data, error } = await supabase.auth.getClaims();

  const sub = data?.claims?.sub;
  if (!error && typeof sub === "string" && sub) {
    const email = data?.claims?.email;
    return { id: sub, email: typeof email === "string" ? email : null };
  }

  /*
    No usable claims, which is the ordinary signed-out answer: with no token
    in the cookies at all, getClaims gives up before it touches the network
    and so does this, which is why a signed-out visitor still costs nothing.

    Asked again anyway rather than concluded from one library call. Being
    wrong in this direction signs somebody out of their own account, and a
    second look is cheap next to that.
  */
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;
  return { id: user.id, email: user.email ?? null };
}

/**
 * The signed-in account and its profile row. Cached per request so a layout
 * and its pages share one round trip.
 *
 * Never prerendered. Who is signed in is not knowable when the app is built,
 * and `connection()` is what says so: without it a component that only reads
 * the session resolves happily at build time to nobody, and that answer is
 * baked into the static shell. The greeting on Home did exactly that -- the
 * shell said "Hi there", and a signed-in player watched it turn into their own
 * name a moment later.
 *
 * Everything that needs a session goes through here, so saying it once here
 * is what makes every caller right rather than every caller remembering.
 */
export const getSession = cache(
  async (): Promise<{ user: SessionUser | null; profile: Profile | null }> => {
    await connection();

    // Without a project wired up there is no session to have. Callers redirect.
    if (!isSupabaseConfigured) return { user: null, profile: null };

    const supabase = await createClient();

    const user = await identify(supabase);
    if (!user) return { user: null, profile: null };

    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle<Profile>();

    return { user, profile: profile ?? null };
  }
);

/** Onboarding is finished once a display name and the age gate are recorded. */
export function isOnboarded(profile: Profile | null) {
  return Boolean(profile?.onboarded_at && profile.display_name && profile.age_confirmed_at);
}
