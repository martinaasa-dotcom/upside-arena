import { createHash, randomBytes } from "node:crypto";

/*
  Joining a second address to an account, decided in one place.

  A player has one account, one player tag and one record, and may want to
  reach all of it from a work address on one day and a personal one the next.
  Every rule about whether that is allowed lives here, apart from the database
  and apart from Google, because the rules are the part worth testing: they are
  what stands between "this is also me" and "this is somebody else's mailbox".

  Nothing in this file talks to the outside world. The caller brings the four
  facts it needs and gets a verdict back.
*/

/** How long a mailed confirmation stays good for. The same hour a sign-in link lasts. */
export const LINK_TOKEN_TTL_MINUTES = 60;

/** At most this many extra addresses on one account. */
export const MAX_LINKED_ADDRESSES = 4;

export type MintedToken = {
  /** Goes in the mail, and is never written down anywhere. */
  token: string;
  /** Goes in the database, and cannot be turned back into the token. */
  hash: string;
  expiresAt: string;
};

/**
 * A confirmation token and the digest that will be stored for it.
 *
 * Hashed for the same reason a password is: the table holding these is read
 * by more things than the one route that checks them, and a token kept in
 * the clear is a token anybody who can read a backup can spend.
 */
export function mintLinkToken(now: Date = new Date()): MintedToken {
  const token = randomBytes(32).toString("base64url");
  return {
    token,
    hash: hashLinkToken(token),
    expiresAt: new Date(
      now.getTime() + LINK_TOKEN_TTL_MINUTES * 60 * 1000
    ).toISOString(),
  };
}

export function hashLinkToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Where the confirmation in the mail points. */
export function linkUrl(origin: string, token: string): string {
  return `${origin}/auth/link?token=${encodeURIComponent(token)}`;
}

/*
  What should happen when an account asks for an address.

  "already" is not a failure. Somebody who connects the same Google account
  twice, or types the address they already sign in with, has asked for a state
  the account is in, and telling them off for it helps nobody.

  "adopt" is the one that closes something, and it is deliberately narrow. It
  only comes up when the address already has an Arena account that has never
  been used for anything: no tag, no week played, no league, nothing bought.
  Somebody who signed in with their second address once, saw it ask for a
  player tag and closed the tab is the whole of the case it exists for.
*/
export type ClaimVerdict =
  | { kind: "ok" }
  | { kind: "adopt"; account: string }
  | { kind: "already" }
  | { kind: "refuse"; code: AddressOutcome };

/*
  Every way asking for an address can end, and the one sentence each of them
  says.

  In one place because two roads arrive at the same outcomes: a form on the
  profile screen, which can answer in the page, and a Google handshake, which
  comes back as a redirect and can only carry a word. A word and a sentence
  kept apart would drift, and the sentence somebody reads would depend on which
  button they pressed.
*/
export type AddressOutcome =
  | "linked"
  | "already"
  | "sent"
  | "linked-elsewhere"
  | "has-record"
  | "limit"
  | "no-mail"
  | "not-configured"
  | "failed";

export const ADDRESS_MESSAGES: Record<AddressOutcome, string> = {
  linked: "That address now opens this account.",
  already: "That address already opens this account.",
  sent: "Check that inbox. The link in it lasts one hour.",
  "linked-elsewhere":
    "That address already reaches another Arena account. Take it off there first.",
  "has-record":
    "That address already has an Arena account with a record on it. Two accounts that have both been played cannot be joined here. Email app.support@upthink.ee.",
  limit: `An account holds ${MAX_LINKED_ADDRESSES} extra addresses at most. Take one off to add another.`,
  "no-mail":
    "Arena cannot send mail from this deployment, so an address cannot be confirmed here. Connect with Google instead.",
  "not-configured": "Adding an address is not switched on here yet.",
  failed: "We could not do that. Try once more.",
};

export type ClaimFacts = {
  /** The account asking. */
  me: string;
  /** The address being asked for, normalized. */
  email: string;
  /** The address this account already signs in with. */
  primaryEmail: string | null;
  /*
    The account this address is already on, and whether that row is confirmed
    or still waiting for somebody to open a link. The difference matters: a
    row of this account's own that nobody confirmed is a request to send the
    link again, not an address that already works.
  */
  linked: { account: string; verified: boolean } | null;
  /** The account that signs in with this address today, if any. */
  loginAccount: string | null;
  /** Whether that account has ever been used. Only asked about when there is one. */
  neverPlayed: boolean;
  /*
    How many other addresses are on this account, not counting the primary and
    not counting this one. Excluding this one is what lets somebody at the
    limit ask for their own confirmation to be sent again.
  */
  linkedCount: number;
};

export function decideClaim(facts: ClaimFacts): ClaimVerdict {
  if (facts.primaryEmail && facts.email === facts.primaryEmail.toLowerCase()) {
    return { kind: "already" };
  }

  if (facts.linked?.account === facts.me) {
    return facts.linked.verified ? { kind: "already" } : { kind: "ok" };
  }

  if (facts.linked) return { kind: "refuse", code: "linked-elsewhere" };

  if (facts.loginAccount && facts.loginAccount !== facts.me) {
    if (!facts.neverPlayed) return { kind: "refuse", code: "has-record" };

    /*
      Room is checked after the accounts, so somebody at the limit is told the
      real reason they cannot add this particular address rather than being
      sent away to make space for one that was never going to be allowed.
    */
    if (facts.linkedCount >= MAX_LINKED_ADDRESSES) {
      return { kind: "refuse", code: "limit" };
    }

    return { kind: "adopt", account: facts.loginAccount };
  }

  if (facts.linkedCount >= MAX_LINKED_ADDRESSES) return { kind: "refuse", code: "limit" };

  return { kind: "ok" };
}
