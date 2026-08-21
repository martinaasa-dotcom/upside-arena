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

export function siteUrl() {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ??
    "http://localhost:3000";
  return raw.replace(/\/$/, "");
}
