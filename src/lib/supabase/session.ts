import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from "@/lib/env";
import { buildContentSecurityPolicy } from "@/lib/security-headers";

/** Routes a signed-out visitor may see. Everything else needs a session. */
const PUBLIC_PATHS = [
  "/",
  "/legal/terms",
  "/legal/privacy",
  // The service worker falls back to this when the network is gone, so it has
  // to be reachable without a session.
  "/offline",
  "/auth/callback",
  "/auth/confirm",
  "/auth/error",
];

/*
  API routes that must stay open to an unauthenticated caller. Payment provider
  webhooks belong here when they arrive, since they authenticate by signature
  rather than by session.
*/
const PUBLIC_API_PATHS: string[] = [
  // Authenticates with a shared secret rather than a session, and refuses
  // the request itself when the secret is missing or wrong.
  "/api/cron/settle",
  "/api/cron/notify",

  // Stripe authenticates by signing the request body, not by holding a
  // session. Left off this list the endpoint answers 401 to Stripe, which
  // retries for days while nobody's subscription is ever recorded.
  "/api/stripe/webhook",
];

function isPublic(pathname: string) {
  return (
    PUBLIC_PATHS.includes(pathname) ||
    PUBLIC_API_PATHS.includes(pathname) ||
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/icons/") ||
    /*
      A shared week card, and the picture that goes with it.

      Signed out on purpose. These links are posted into group chats, and a
      page that asked for an account before showing anything would end the
      share loop before it started. Each one shows a single frozen week and
      offers no way to reach the player behind it.
    */
    pathname.startsWith("/w/") ||
    pathname === "/manifest.webmanifest" ||
    pathname === "/sw.js" ||
    /*
      The component gallery, which the clipping probe measures and a design
      pass is read on. Behind the same switch as the route itself: without
      ARENA_UI_GALLERY the page answers 404, and a deployment never sets it,
      so this cannot open anything on a real site. Without the clause the
      probe measured the sign-in page it was redirected to instead.
    */
    (pathname === "/gallery" && Boolean(process.env.ARENA_UI_GALLERY))
  );
}

export async function updateSession(request: NextRequest) {
  const csp = buildContentSecurityPolicy();

  let response = NextResponse.next({ request });
  response.headers.set("Content-Security-Policy", csp);

  // Without a project configured the app still renders its signed-out shell.
  if (!isSupabaseConfigured) return response;

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        response.headers.set("Content-Security-Policy", csp);
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  /*
    Refreshes an expiring token, and answers whether anybody is signed in. Do
    not remove, and do not run any other logic between creating the client and
    this call.

    getClaims rather than getUser, for the reason lib/profile.ts already
    changed for and this file was left behind on. getUser asks the auth server
    every time, and this proxy matches every request the app serves -- every
    navigation, every prefetch, every RSC fetch -- so that round trip was being
    paid before a page could begin. getClaims refreshes the same way, through
    getSession, and then verifies the token against the project's published
    keys, which on a project signing asymmetrically is local once the key set
    has been fetched once.

    It is not a relaxation. The signature is still checked before a claim is
    believed; an unsigned or expired token yields nothing and the caller is
    treated as signed out.
  */
  const { data: claims, error: claimsError } = await supabase.auth.getClaims();

  const sub = claims?.claims?.sub;
  let signedIn = !claimsError && typeof sub === "string" && sub.length > 0;

  if (!signedIn) {
    /*
      Asked again rather than concluded from one library call, because being
      wrong in this direction signs somebody out of their own account. It is
      cheap: with no token in the cookies there is nothing to ask about and
      neither call touches the network, so a signed-out visitor pays nothing.
    */
    const {
      data: { user },
    } = await supabase.auth.getUser();
    signedIn = Boolean(user);
  }

  const { pathname } = request.nextUrl;

  if (!signedIn && !isPublic(pathname)) {
    /*
      An API caller gets a status code, not a redirect to a web page. Sending
      HTML to something expecting JSON turns "not signed in" into a parse
      error at the other end.
    */
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    }

    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (signedIn && pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/home";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}
