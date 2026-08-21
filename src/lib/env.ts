/*
  Secrets live in environment variables only, never in the repo.
  See .env.example for the full list.
*/

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** True once a real Supabase project is wired up. */
export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

/*
  Service role key. Server only, never sent to a browser, never committed.

  The game engine needs it because a player may read their portfolio but write
  none of it: cash, holdings and trades are all written by the server through
  functions only this role may call. Without it the app still runs, and
  trading is turned off rather than made insecure.
*/
export const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

/** True once the server can write the game. */
export const canWriteGame = Boolean(
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
);

/** Google sign-in only shows when the provider is turned on in Supabase. */
export const isGoogleEnabled =
  process.env.NEXT_PUBLIC_ENABLE_GOOGLE_AUTH === "true";

const LOCAL_ORIGIN = "http://localhost:3000";

/**
 * Where this deployment lives, used to build sign-in links.
 *
 * An environment variable that exists but is empty is treated as unset. That
 * is not hypothetical: a blank value in a hosting dashboard is a normal way to
 * leave a placeholder, and `??` would hand the empty string straight through
 * to `new URL()`, which throws and fails the whole build.
 */
export function siteUrl() {
  const candidates = [
    process.env.NEXT_PUBLIC_SITE_URL?.trim(),
    process.env.VERCEL_URL?.trim()
      ? `https://${process.env.VERCEL_URL.trim()}`
      : "",
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;
    const withScheme = /^https?:\/\//.test(candidate)
      ? candidate
      : `https://${candidate}`;
    try {
      // A malformed value should fall back rather than break every page.
      return new URL(withScheme).origin;
    } catch {
      continue;
    }
  }

  return LOCAL_ORIGIN;
}
