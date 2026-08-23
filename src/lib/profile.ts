import { cache } from "react";
import { cacheLife, cacheTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import type { Profile } from "@/lib/types";

/** Who the caller is. Only what a page ever asks for, and both verified. */
export type SessionUser = { id: string; email: string | null };

/**
 * The cache entry holding one player's own session, so the two places that
 * write a profile can throw it away the moment they do.
 */
export function sessionTag(userId: string) {
  return `session:${userId}`;
}

/*
  Long enough to be worth having, and it is a specific number rather than a
  taste.

  A private cache entry is only carried in a route's App Shell -- the thing a
  link prefetches, and therefore the thing a tap paints -- if its stale time
  is at least five minutes. Below that the entry is still a cache and still
  saves the round trip, but the session lands after the tap instead of before
  it, which is the whole difference this is here to make.

  Nothing waits five minutes to be right, because nothing here waits for time
  at all: both writers drop the tag, so a player who changes their name sees
  the new one on the next screen.
*/
const SESSION_STALE_SECONDS = 300;

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

/*
  The profile row, cached in the browser that asked, under the account it
  belongs to.

  Every room opens by asking who is here, so this row was fetched again on
  every tab, and the room could not begin to paint until it came back. It is
  the same row every time and it changes when the player changes it, which is
  a cache with an obvious invalidation rather than a guess about freshness.

  Two things about the shape, both of which took a second look to get right.

  It is keyed by the user id, and that is not decoration. A cache key is built
  from a function's arguments; cookies read inside the body are not part of
  it. Cached with no arguments, this would have had one key for everybody, and
  two accounts used from the same browser within the stale window would have
  been the same entry -- one player wearing another's name, and on the metrics
  page one player seeing what only an owner may. The id comes from a verified
  token and putting it in the signature is what makes the entry belong to
  somebody.

  And it is "private", the variant that may read cookies, which is what lets
  the row still be read as the player rather than around them: the request
  goes through their own session and row level security answers it, exactly as
  it did when this was uncached. Private also means the entry is held in the
  browser that asked and nowhere else -- never written to a server, never
  shared between people, gone when the tab is.

  This also replaces what connection() used to do here. Both say "not at build
  time" -- connection() by refusing to resolve without a request, this by
  being excluded from static shell generation -- and only one of them also
  stops the row being read again on every screen. connection() is not merely
  unnecessary now; it is forbidden inside a cached scope, which is the
  framework saying the same thing.
*/
async function readProfile(userId: string): Promise<Profile | null> {
  "use cache: private";
  cacheLife({ stale: SESSION_STALE_SECONDS });

  /*
    Tagged with the account rather than with a path. The two places that write
    a profile know the id and nothing else about where it will be read, and a
    tag is the only handle that survives being read somewhere neither of them
    has heard of.
  */
  cacheTag(sessionTag(userId));

  const supabase = await createClient();

  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle<Profile>();

  return data ?? null;
}

/**
 * The signed-in account and its profile row.
 *
 * Who is asking is settled on every single request and is deliberately not
 * cached: it is a signature check against a token that is already in hand,
 * it costs nothing, and it is the one answer here that must never be a
 * moment old. What is cached is the round trip that follows it.
 *
 * Wrapped in React's cache as well, so several components streaming at once
 * within one render share a single call rather than one cache lookup each.
 * Everything that needs a session comes through here, which is what makes
 * every caller right rather than every caller remembering.
 */
export const getSession = cache(
  async (): Promise<{ user: SessionUser | null; profile: Profile | null }> => {
    // Without a project wired up there is no session to have. Callers redirect.
    if (!isSupabaseConfigured) return { user: null, profile: null };

    const supabase = await createClient();

    const user = await identify(supabase);
    if (!user) return { user: null, profile: null };

    return { user, profile: await readProfile(user.id) };
  }
);

/** Onboarding is finished once a display name and the age gate are recorded. */
export function isOnboarded(profile: Profile | null) {
  return Boolean(profile?.onboarded_at && profile.display_name && profile.age_confirmed_at);
}
