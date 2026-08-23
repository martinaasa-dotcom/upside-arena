import { cache } from "react";
import { cookies } from "next/headers";
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
  A signed-in player, invented, for looking at the rooms without a project.

  Behind an environment variable that no deployment sets -- the same shape as
  ARENA_UI_GALLERY, and for the same reason. Every room in this app is behind
  a sign-in, which is why the one thing nobody could ever watch was the thing
  players complain about: what a room does in the moment after a tap. Four
  attempts at making that instant were reasoned from documentation and shipped
  without anybody seeing the screen, and all four were wrong.

  This is what let the fifth be seen before it was sent. See
  tests/instant/room-arrival.spec.ts, which drives a real navigation against
  it and reads what is on screen in the first frame.
*/
const STUB_SESSION = process.env.ARENA_STUB_SESSION === "1";

/*
  How slow to pretend to be.

  Without this the probe proves nothing. A stub answers instantly, every
  boundary resolves in the same tick, and a room with a hole in it looks
  exactly like a room without one -- which it did, and which nearly had the
  broken version measured as fixed. What a player is describing is latency,
  so latency is the thing the probe has to have.
*/
const STUB_LATENCY_MS = Number(process.env.ARENA_STUB_LATENCY_MS ?? "0");

const slowly = <T,>(value: T): Promise<T> =>
  STUB_LATENCY_MS > 0
    ? new Promise((resolve) => setTimeout(() => resolve(value), STUB_LATENCY_MS))
    : Promise.resolve(value);

const STUB_USER: SessionUser = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "probe@example.invalid",
};

const STUB_PROFILE = {
  id: STUB_USER.id,
  handle: "probe",
  display_name: "Probe",
  avatar_url: null,
  age_confirmed_at: "2026-01-01T00:00:00Z",
  rating: 1000,
  weeks_played: 3,
  best_week_return: 4.2,
  career_alpha_avg: 1.1,
  longest_streak: 5,
  equipped_title: null,
  equipped_flair: null,
  equipped_theme: null,
  onboarded_at: "2026-01-01T00:00:00Z",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
} as Profile;

/*
  The whole session, cookies and all, inside one private cache.

  This is the shape the fourth attempt got wrong. The profile row was cached
  and settling who is asking was left outside it, on the reasoning that
  identity must never be a moment old. That reasoning was right about identity
  and wrong about what it cost: reading a cookie is a runtime API, so a
  function that reads one cannot be prerendered, and every room begins by
  awaiting this. One uncached root turned all of it back into a hole, and
  every cached read behind it still arrived after the tap. Adding a single
  cookies() call to this function is enough to move /home from static to
  partially prerendered, which is how it was finally found.

  "private" is the variant that may read cookies and still be carried in a
  route's App Shell -- the thing a link prefetches -- provided its stale time
  is at least five minutes. That is what puts a player's own name and numbers
  in the frame the tap paints, rather than in what arrives afterwards.

  On the identity worry, which is real and is answered by where this lives
  rather than by a key. The entry is held in the browser that asked, never on
  a server, never shared between people, and does not survive a page load.
  Every way into this app as somebody else is a page load: a link from an
  email, a callback from Google. So a second account cannot inherit the
  first's entry.

  And it is not the lock in any case. proxy.ts reads the cookie itself on
  every single request and refuses every room without a valid one, and it is
  not cached. What this decides is what a room draws for somebody already let
  in, which is exactly the kind of thing a cache is for.
*/
async function readSession(): Promise<{
  user: SessionUser | null;
  profile: Profile | null;
}> {
  "use cache: private";
  cacheLife({ stale: SESSION_STALE_SECONDS });

  if (STUB_SESSION) {
    // Read like the real path reads, so what is measured here is what ships.
    await cookies();
    return slowly({ user: STUB_USER, profile: STUB_PROFILE });
  }

  // Without a project wired up there is no session to have. Callers redirect.
  if (!isSupabaseConfigured) return { user: null, profile: null };

  const supabase = await createClient();

  const user = await identify(supabase);
  if (!user) return { user: null, profile: null };

  /*
    Tagged with the account rather than with a path. The two places that write
    a profile know the id and nothing else about where it will be read, and a
    tag is the only handle that survives being read somewhere neither of them
    has heard of.
  */
  cacheTag(sessionTag(user.id));

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle<Profile>();

  return { user, profile: profile ?? null };
}

/**
 * The signed-in account and its profile row.
 *
 * Wrapped in React's cache as well, so several components streaming at once
 * within one render share a single call rather than one cache lookup each.
 * Everything that needs a session comes through here, which is what makes
 * every caller right rather than every caller remembering.
 */
export const getSession = cache(readSession);

/** Onboarding is finished once a display name and the age gate are recorded. */
export function isOnboarded(profile: Profile | null) {
  return Boolean(profile?.onboarded_at && profile.display_name && profile.age_confirmed_at);
}
