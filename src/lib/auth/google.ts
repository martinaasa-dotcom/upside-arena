import "server-only";

import { siteUrl } from "@/lib/env";

/*
  Google sign-in, run on Arena's own domain.

  Supabase can do this whole handshake for us, and doing it that way is one
  line of code. The reason it is not done that way is what the person signing
  in reads: Google names an app by the domain of the redirect it is sending
  the browser to, and with Supabase's own callback that is
  "<project>.supabase.co". Not a domain we own, not a name anyone recognises,
  and it puts a stranger's hostname on the privacy policy and terms links too.
  The App name on the consent screen does not override it.

  So Arena takes the redirect itself. Google returns to upsidearena.com, which
  is the name it then shows, and the ID token that comes out is handed to
  Supabase, which verifies it and issues the session exactly as before.

  The alternative is Supabase's paid custom domain add-on, which fixes the
  same thing by moving their callback onto a host we own. This costs nothing
  and is a documented flow, but it does mean the code below is ours to get
  right rather than theirs.
*/

function clientId() {
  return process.env.GOOGLE_CLIENT_ID ?? "";
}

function clientSecret() {
  return process.env.GOOGLE_CLIENT_SECRET ?? "";
}

const AUTHORIZE = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN = "https://oauth2.googleapis.com/token";

/**
 * On, only when it can actually work.
 *
 * A flag saying a button should appear is not the same as being able to sign
 * somebody in, and a button that can only fail is worse than no button.
 */
/**
 * Whether Arena holds the credentials to complete the handshake.
 *
 * Asked as a question rather than answered once when this module loads. The
 * difference matters now that the sign-in page has a prerendered shell: a
 * value read at module scope is read while the page is being built, and a
 * credential that is only present at runtime would have been recorded as
 * absent for the life of the deployment. The button would simply not be
 * there, and nothing anywhere would say why.
 *
 * It is called from the request-time part of that page, so what it reads is
 * what the running server actually has.
 */
export function googleConfigured(): boolean {
  return Boolean(clientId() && clientSecret());
}

/** Where Google returns to. Registered in the Google client, and ours. */
export function googleRedirectUri() {
  return `${siteUrl()}/auth/google/callback`;
}

export function authorizeUrl(state: string): string {
  const url = new URL(AUTHORIZE);

  url.searchParams.set("client_id", clientId());
  url.searchParams.set("redirect_uri", googleRedirectUri());
  url.searchParams.set("response_type", "code");
  /*
    The three that make a sign-in and nothing more. Anything beyond this turns
    a one-tap into a permissions dialogue people back out of, and Arena has no
    use for a wider grant.
  */
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", state);
  // Ask every time rather than silently reusing whichever account the browser
  // last used. People have more than one, and choosing for them is a support
  // ticket.
  url.searchParams.set("prompt", "select_account");
  /*
    No nonce is sent, so the ID token carries no nonce claim for Supabase to
    check. A nonce is what stops an ID token lifted from a redirect being
    replayed, and this is the authorization code flow: the token never goes
    near a browser. It is fetched by this server, over TLS, from Google's
    token endpoint, in exchange for a single-use code that is worthless
    without the client secret. The state cookie above is the protection that
    matters here, and it is not optional.
  */

  return url.toString();
}

export type GoogleTokens =
  | { ok: true; idToken: string; accessToken: string }
  | { ok: false; reason: string };

/**
 * Trades the code for the tokens, server side.
 *
 * The client secret never leaves here, which is the whole reason this leg is
 * on a server rather than in the page that started it.
 */
export async function exchangeCode(code: string): Promise<GoogleTokens> {
  if (!googleConfigured()) return { ok: false, reason: "not-configured" };

  try {
    const response = await fetch(TOKEN, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId(),
        client_secret: clientSecret(),
        redirect_uri: googleRedirectUri(),
        grant_type: "authorization_code",
      }),
      cache: "no-store",
    });

    if (!response.ok) return { ok: false, reason: "exchange" };

    const body = (await response.json()) as {
      id_token?: string;
      access_token?: string;
    };

    if (!body.id_token || !body.access_token) {
      return { ok: false, reason: "exchange" };
    }

    /*
      Both, not just the identity token. Google's code-flow token carries an
      at_hash claim binding it to the access token, and Supabase refuses a
      token with that claim unless it is given the access token to check
      against.
    */
    return { ok: true, idToken: body.id_token, accessToken: body.access_token };
  } catch {
    return { ok: false, reason: "exchange" };
  }
}
