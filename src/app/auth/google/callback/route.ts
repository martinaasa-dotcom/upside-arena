import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { exchangeCode } from "@/lib/auth/google";
import { STATE_COOKIE, decideCallback } from "@/lib/auth/google-state";

/*
  The return leg of Google sign-in.

  Google sends the browser here, to Arena's own domain, which is the whole
  point: the domain it returns to is the name it shows on the consent screen.

  What to do with the request is decided in google-state.ts, so that the order
  of the checks can be tested. This file does only the parts that need the
  outside world: the cookie jar, Google's token endpoint, and Supabase.
*/
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;

  const jar = await cookies();
  const cookie = jar.get(STATE_COOKIE)?.value ?? null;

  /*
    Single use, before anything is acted on. A state that survives its own
    callback is a state that can be replayed, and that has to be true whether
    this request goes on to succeed or fail.
  */
  jar.delete(STATE_COOKIE);

  const decision = decideCallback({
    error: searchParams.get("error"),
    code: searchParams.get("code"),
    state: searchParams.get("state"),
    cookie,
  });

  if (decision.kind === "cancelled") return NextResponse.redirect(`${origin}/`);
  if (decision.kind === "fail") {
    return NextResponse.redirect(`${origin}/auth/error?reason=${decision.reason}`);
  }

  const tokens = await exchangeCode(decision.code);
  if (!tokens.ok) {
    return NextResponse.redirect(`${origin}/auth/error?reason=${tokens.reason}`);
  }

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

  if (error) return NextResponse.redirect(`${origin}/auth/error?reason=identity`);

  return NextResponse.redirect(`${origin}${decision.next}`);
}
