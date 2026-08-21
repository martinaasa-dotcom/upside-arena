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
/*
  Who may see the numbers.

  A comma separated list of email addresses, server side only. Deliberately
  not a flag on a profile row: a database column that grants access to every
  player's aggregates is one bad row away from being wrong, while an
  environment variable can only be changed by somebody who can already deploy.

  Unset means nobody, which is the safe direction. An unset variable must
  never be the thing that opens something.
*/
const ADMIN_EMAILS = (process.env.ARENA_ADMIN_EMAILS ?? "")
  .split(",")
  .map((entry) => entry.trim().toLowerCase())
  .filter(Boolean);

export const hasAdmins = ADMIN_EMAILS.length > 0;

export function isAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.trim().toLowerCase());
}

/*
  Where this deployment thinks it lives.

  Sign-in links, notification emails and share URLs are all built from this,
  so a wrong answer is not cosmetic: it emails somebody a link to a machine
  they do not have, and Supabase refuses any redirect that is not on its allow
  list.

  The order matters.

  NEXT_PUBLIC_SITE_URL wins, always. It is the explicit answer and the only one
  a person controls.

  On production, the project's production domain comes next. VERCEL_URL is
  deliberately NOT used there: it names this exact deployment
  (upside-arena-abc123-team.vercel.app), which changes on every push, is not
  where somebody clicking a link tomorrow should land, and is not on Supabase's
  redirect allow list. Falling through to it would produce links that look
  plausible and fail.

  VERCEL_URL is right for a preview deployment, where the deployment really is
  the site.

  Localhost is last, and only correct when nothing else is set, which means
  somebody is running it on their own machine.
*/
export function siteUrl() {
  const onProduction = process.env.VERCEL_ENV === "production";

  const candidates = [
    process.env.NEXT_PUBLIC_SITE_URL?.trim(),
    onProduction ? process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim() : "",
    onProduction ? "" : process.env.VERCEL_URL?.trim(),
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
