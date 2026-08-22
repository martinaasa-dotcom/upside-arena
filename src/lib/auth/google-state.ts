import { randomBytes } from "node:crypto";
import { safeNext } from "@/lib/redirects";

/*
  The state that ties a Google sign-in request to its answer.

  Separate from the rest of the handshake, and free of anything server side,
  because this is the part worth testing hardest: it is the only thing
  standing between a stranger's authorization code and somebody's session.
*/

/*
  Http-only, so no script can read it, and scoped to the callback path so it
  is not sent with every other request on the site.
*/
export const STATE_COOKIE = "arena_google_state";

/** How long a started sign-in stays answerable. */
export const STATE_MAX_AGE_SECONDS = 600;

/**
 * The state for one sign-in: a secret for the URL, and what the cookie holds.
 *
 * Where somebody was heading travels in the cookie rather than in the state
 * parameter, for two reasons. Google hands the state back only as an opaque
 * string, so a destination put there would have to be read back out of
 * attacker-reachable input. And there is no way to make that input
 * tamper-evident with a public hash: anyone who can change the destination
 * can recompute a digest of it. The cookie is http-only and was set by this
 * server, so nothing outside it decides where the browser lands.
 */
export function stateFor(next: string): { cookie: string; param: string } {
  const secret = randomBytes(32).toString("base64url");
  return { cookie: `${secret}|${next}`, param: secret };
}

/** Splits the cookie back into the secret and the destination it was for. */
export function readStateCookie(value: string): { secret: string; next: string } {
  const separator = value.indexOf("|");
  if (separator < 0) return { secret: value, next: "" };
  return { secret: value.slice(0, separator), next: value.slice(separator + 1) };
}

/**
 * Constant time, because comparing secrets with === leaks their length.
 *
 * An empty state is refused outright. Without that, a callback arriving with
 * no state at all and a browser holding no cookie would compare equal.
 */
export function sameState(a: string, b: string): boolean {
  if (a.length !== b.length || a.length === 0) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/*
  What the callback should do, decided before anything is acted on.

  Kept here, apart from the route, because this is the part that matters: the
  order of these checks is what stops a stranger's authorization code being
  spent on somebody else's session, and logic buried in a route handler is
  logic nobody can write a test for.
*/
export type CallbackDecision =
  | { kind: "cancelled" }
  | { kind: "fail"; reason: string }
  | { kind: "proceed"; code: string; next: string };

export function decideCallback(input: {
  error: string | null;
  code: string | null;
  state: string | null;
  cookie: string | null;
}): CallbackDecision {
  /*
    Google reports a refusal through the query string rather than by failing.
    Somebody who pressed cancel has not hit an error and should not be shown
    one.
  */
  if (input.error) return { kind: "cancelled" };

  if (!input.code) return { kind: "fail", reason: "missing-code" };

  /*
    The state is checked before the code is worth anything. A callback whose
    state does not match this browser's own cookie was not started here, and
    an empty cookie fails this rather than matching an empty state.
  */
  const expected = readStateCookie(input.cookie ?? "");
  if (!sameState(input.state ?? "", expected.secret)) {
    return { kind: "fail", reason: "state" };
  }

  /*
    Where they were heading comes from the cookie this server set. It is still
    run through safeNext, because a cookie is only as trustworthy as the last
    thing that wrote it, and an open redirect is not worth the assumption.
  */
  return { kind: "proceed", code: input.code, next: safeNext(expected.next) };
}
