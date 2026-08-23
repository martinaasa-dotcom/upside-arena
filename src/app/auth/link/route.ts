import { NextResponse, type NextRequest } from "next/server";
import { confirmAddressLink } from "@/lib/auth/linked-emails";

/*
  The far end of a confirmation sent to an address somebody wants to add.

  Deliberately not behind a session. The proof this route wants is that the
  person holds the mailbox the link was sent to, and that is the link itself:
  they may well be reading it on a phone that has never been signed in to
  Arena, which is the ordinary case rather than the odd one. The token names
  the account, so nothing is guessed at.

  It signs nobody in either. Confirming an address and using it are two
  different acts, and a link in a mailbox that opened somebody's account
  would be a sign-in link posted to an address nobody has confirmed yet.
*/
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(`${origin}/auth/error?reason=missing-token`);
  }

  const result = await confirmAddressLink(token);

  if (result.kind === "fail") {
    return NextResponse.redirect(`${origin}/auth/error?reason=${result.reason}`);
  }

  return NextResponse.redirect(
    `${origin}/auth/linked?email=${encodeURIComponent(result.email)}`
  );
}
