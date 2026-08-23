import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { exchangeCode, googleEmail } from "@/lib/auth/google";
import { STATE_COOKIE, decideCallback } from "@/lib/auth/google-state";
import {
  accountForAddress,
  connectGoogleAddress,
  magicTokenFor,
} from "@/lib/auth/linked-emails";

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

  const supabase = await createClient();

  /*
    The address on the Google account, read before anything is done with the
    token. It decides which of the three things below happens, and a token
    Arena cannot read an address out of is a token it will not act on.
  */
  const email = googleEmail(tokens.idToken);
  if (!email) return NextResponse.redirect(`${origin}/auth/error?reason=identity`);

  if (decision.intent === "link") {
    return connectToSignedInAccount(supabase, origin, email);
  }

  /*
    An address added to an account opens that account.

    Handed to Supabase instead, this token would be a Google identity it has
    never seen, and it would make a second account: the same person, a new
    player tag, none of their weeks. So the session comes from a one-time token
    minted for the account the address was added to. Nobody's identity is
    guessed at here. Google confirmed the address and the account itself
    confirmed the address earlier, in the profile screen.
  */
  const linked = await accountForAddress(email);

  if (linked) {
    const tokenHash = await magicTokenFor(linked.primaryEmail);
    if (!tokenHash) {
      return NextResponse.redirect(`${origin}/auth/error?reason=identity`);
    }

    /*
      Spent here rather than sent to the browser, so the token never appears in
      a URL, a history entry or a referrer on the way to being used.
    */
    const { error } = await supabase.auth.verifyOtp({
      type: "magiclink",
      token_hash: tokenHash,
    });

    if (error) return NextResponse.redirect(`${origin}/auth/error?reason=identity`);

    return NextResponse.redirect(`${origin}${decision.next}`);
  }

  /*
    Supabase verifies the token's signature against Google's keys, checks it
    was issued for the client id configured on the project, and creates or
    links the account. Arena never decides who somebody is; it only carries
    the proof from one place to the other.
  */
  const { error } = await supabase.auth.signInWithIdToken({
    provider: "google",
    token: tokens.idToken,
    access_token: tokens.accessToken,
  });

  if (error) return NextResponse.redirect(`${origin}/auth/error?reason=identity`);

  return NextResponse.redirect(`${origin}${decision.next}`);
}

/**
 * Adding the address on the Google account somebody just proved they hold, to
 * the account they are signed in to here.
 *
 * The session is the one already in the browser. A handshake that came back
 * to a signed out browser cannot say which account it was for, so it does
 * nothing at all rather than guessing at one.
 */
async function connectToSignedInAccount(
  supabase: Awaited<ReturnType<typeof createClient>>,
  origin: string,
  email: string
) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.redirect(`${origin}/auth/error?reason=link-signed-out`);

  const result = await connectGoogleAddress({
    userId: user.id,
    primaryEmail: user.email ?? null,
    email,
  });

  const outcome = result.kind === "fail" ? result.code : result.kind;

  return NextResponse.redirect(`${origin}/profile?address=${outcome}`);
}
