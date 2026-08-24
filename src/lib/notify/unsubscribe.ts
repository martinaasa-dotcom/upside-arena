import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { SUPABASE_SERVICE_ROLE_KEY } from "@/lib/env";
import { siteUrl } from "@/lib/env";

/*
  Turning the emails off from inside the email.

  There was a link and it went to /profile, which is behind a sign-in. That is
  an unsubscribe in the sense that the word appears: somebody who no longer
  wants Arena's mail is asked to remember an account they have stopped using,
  find the setting and turn it off. What they actually do is press the button
  that marks it as spam, and one of those costs more than a hundred people
  quietly turning the emails off, because it is charged against the domain
  every other message is sent from.

  Gmail and Yahoo have both required one-click unsubscribe of bulk senders
  since 2024, and the mechanism is small: a header carrying a URL, a second
  header saying the client may POST to it without asking, and an endpoint that
  believes the request because the URL carries proof of who it is for.

  The proof is an HMAC of the user id. It is not a session and it is not a
  capability: the only thing this signature permits is turning somebody's
  email off, which is the one action nobody has ever needed protecting from.

  There is no expiry, deliberately. An unsubscribe link in a two year old
  email is exactly the one somebody is most likely to press, and a link that
  answers "this has expired" to that person has failed at its only job.
*/

/**
 * The key the signature is made with.
 *
 * Its own variable when there is one, and the service role key otherwise, so
 * this works on a deployment nobody has configured for it. Both are server
 * side and neither is ever in a browser. With neither, there is no signature
 * and no header: an unset variable must never be the thing that opens
 * something, and a link anybody could forge would let a stranger turn off a
 * stranger's mail.
 */
function secret(): string {
  return process.env.UNSUBSCRIBE_SECRET || SUPABASE_SERVICE_ROLE_KEY || "";
}

function sign(userId: string, key: string): string {
  return createHmac("sha256", key).update(`unsubscribe:${userId}`).digest("base64url");
}

/** The link that goes in the header and at the foot of the mail. */
export function unsubscribeUrlFor(userId: string): string | null {
  const key = secret();
  if (!key || !userId) return null;

  const url = new URL("/api/unsubscribe", siteUrl());
  url.searchParams.set("u", userId);
  url.searchParams.set("s", sign(userId, key));
  return url.toString();
}

/**
 * Who a link is for, or null if it is not one of ours.
 *
 * Compared in constant time, which matters less here than almost anywhere
 * else in the app and costs nothing: a signature checked character by
 * character tells whoever is guessing how much of their guess was right.
 */
export function userFromUnsubscribe(
  userId: string | null,
  signature: string | null
): string | null {
  const key = secret();
  if (!key || !userId || !signature) return null;

  const expected = Buffer.from(sign(userId, key));
  const given = Buffer.from(signature);

  if (expected.length !== given.length) return null;
  return timingSafeEqual(expected, given) ? userId : null;
}
