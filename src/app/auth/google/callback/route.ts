import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/redirects";
import { exchangeCode } from "@/lib/auth/google";
import {
  STATE_COOKIE,
  readStateCookie,
  sameState,
} from "@/lib/auth/google-state";

/*
  The return leg of Google sign-in.

  Google sends the browser here, to Arena's own domain, which is the whole
  point: the domain it returns to is the name it shows on the consent screen.

  Nothing in the query string is trusted until the state matches the cookie
  set when the request started. An authorization code arriving without that
  is somebody else's, and spending it would sign this browser into their
  account.
*/
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const fail = (reason: string) =>
    NextResponse.redirect(`${origin}/auth/error?reason=${reason}`);

  // Google reports a refusal here rather than by failing. Somebody who
  // pressed cancel has not hit an error, so they go back to the sign-in page.
  if (searchParams.get("error")) return NextResponse.redirect(`${origin}/`);

  const code = searchParams.get("code");
  const state = searchParams.get("state") ?? "";
  if (!code) return fail("missing-code");

  const jar = await cookies();
  const cookie = jar.get(STATE_COOKIE)?.value ?? "";

  // Single use, whatever happens next. A state that survives its callback is
  // a state that can be replayed.
  jar.delete(STATE_COOKIE);

  const expected = readStateCookie(cookie);
  if (!sameState(state, expected.secret)) return fail("state");

  /*
    Where they were heading comes from the cookie this server set, never from
    the query string. Google does not carry it back, and anything that did
    come back would be a destination chosen by whoever sent the browser here.
  */
  const next = safeNext(expected.next);

  const tokens = await exchangeCode(code);
  if (!tokens.ok) return fail(tokens.reason);

  /*
    Supabase verifies the token's signature against Google's keys, checks it
    was issued for the client id configured on the project, and creates or
    links the account. Arena never decides who somebody is; it only carries
    the proof from one place to the other.
  */
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithIdToken({
    provider: "google",
    token: tokens.idToken,
    access_token: tokens.accessToken,
  });

  if (error) return fail("identity");

  return NextResponse.redirect(`${origin}${next}`);
}
