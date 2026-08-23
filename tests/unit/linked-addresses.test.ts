import { describe, expect, it } from "vitest";
import {
  ADDRESS_MESSAGES,
  MAX_LINKED_ADDRESSES,
  decideClaim,
  type ClaimFacts,
} from "@/lib/auth/address-link";
import { googleEmailFromIdToken, readIdTokenClaims } from "@/lib/auth/id-token";

/*
  One account, more than one address.

  These are the rules that decide whether an address may be added to an
  account, and they are the whole of what stands between "this is also me" and
  somebody claiming a mailbox that is not theirs. The proof of holding the
  address happens elsewhere, in a link or in Google's handshake; what is
  checked here is what that proof is allowed to buy.
*/

const ME = "11111111-1111-1111-1111-111111111111";
const SOMEBODY_ELSE = "22222222-2222-2222-2222-222222222222";

function facts(over: Partial<ClaimFacts> = {}): ClaimFacts {
  return {
    me: ME,
    email: "second@gmail.com",
    primaryEmail: "first@upthink.ee",
    linked: null,
    loginAccount: null,
    neverPlayed: false,
    linkedCount: 0,
    ...over,
  };
}

describe("whether an address may be added", () => {
  it("adds one nothing else has a claim on", () => {
    expect(decideClaim(facts())).toEqual({ kind: "ok" });
  });

  it("says nothing needs doing about the address you already sign in with", () => {
    // Not an error. Somebody who types their own address has asked for a state
    // the account is already in.
    expect(decideClaim(facts({ email: "first@upthink.ee" }))).toEqual({
      kind: "already",
    });
  });

  it("matches the primary address whatever case it is held in", () => {
    expect(
      decideClaim(facts({ email: "first@upthink.ee", primaryEmail: "First@Upthink.EE" }))
    ).toEqual({ kind: "already" });
  });

  it("says nothing needs doing about one this account has already confirmed", () => {
    expect(decideClaim(facts({ linked: { account: ME, verified: true } }))).toEqual({
      kind: "already",
    });
  });

  it("lets an unconfirmed row be asked for again rather than calling it done", () => {
    /*
      Nothing writes an unconfirmed row any more: the Google handshake proves
      the mailbox and inserts the address already verified. The rule stays
      because it is the safe way round for a row that predates that or arrives
      some other way, and because "already connected" about an address that
      does not work is the one answer that leaves somebody stuck.
    */
    expect(decideClaim(facts({ linked: { account: ME, verified: false } }))).toEqual({
      kind: "ok",
    });
  });

  it("refuses one that already reaches somebody else's account", () => {
    expect(
      decideClaim(facts({ linked: { account: SOMEBODY_ELSE, verified: true } }))
    ).toEqual({ kind: "refuse", code: "linked-elsewhere" });
  });

  it("refuses an address whose own account has been played", () => {
    /*
      Two accounts with a record each cannot be joined by a link in a mailbox.
      One of them would have to lose its weeks, its tag or its leagues, and
      which one is not a decision this code gets to make.
    */
    expect(
      decideClaim(facts({ loginAccount: SOMEBODY_ELSE, neverPlayed: false }))
    ).toEqual({ kind: "refuse", code: "has-record" });
  });

  it("closes an account on that address that has never been used", () => {
    // Somebody who signed in with their second address once, was asked for a
    // player tag and closed the tab. There is nothing in it to lose.
    expect(
      decideClaim(facts({ loginAccount: SOMEBODY_ELSE, neverPlayed: true }))
    ).toEqual({ kind: "adopt", account: SOMEBODY_ELSE });
  });

  it("never closes the asking account itself", () => {
    expect(decideClaim(facts({ loginAccount: ME, email: "first@upthink.ee" }))).toEqual({
      kind: "already",
    });
  });

  it("lets somebody at the limit ask for their own link again", () => {
    // linkedCount deliberately leaves this address out, so a resend is never
    // refused for a shelf the address is already on.
    expect(
      decideClaim(
        facts({ linkedCount: MAX_LINKED_ADDRESSES - 1, linked: { account: ME, verified: false } })
      )
    ).toEqual({ kind: "ok" });
  });

  it("stops at the limit", () => {
    expect(decideClaim(facts({ linkedCount: MAX_LINKED_ADDRESSES }))).toEqual({
      kind: "refuse",
      code: "limit",
    });
  });

  it("gives the real reason before the limit, so the answer is not misleading", () => {
    /*
      An address that was never going to be allowed is refused for what is
      wrong with it, not for a shelf being full. Otherwise somebody removes a
      good address to make room and is refused again.
    */
    expect(
      decideClaim(
        facts({
          linkedCount: MAX_LINKED_ADDRESSES,
          loginAccount: SOMEBODY_ELSE,
          neverPlayed: false,
        })
      )
    ).toEqual({ kind: "refuse", code: "has-record" });
  });

  it("has a sentence for every way this can end", () => {
    for (const [outcome, sentence] of Object.entries(ADDRESS_MESSAGES)) {
      expect(sentence.length, `${outcome} says nothing`).toBeGreaterThan(10);
    }
  });
});

/*
  Google's identity token, read for the address on it.

  The signature is not checked, for the reason written at the top of
  id-token.ts: this token was fetched by the server from Google's own token
  endpoint over TLS. Everything else about it is checked, and each of those
  checks is one of these.
*/
describe("reading the address off a Google token", () => {
  const CLIENT = "arena.apps.googleusercontent.com";
  const NOW = new Date("2026-08-23T10:00:00.000Z");

  function token(claims: Record<string, unknown>) {
    const part = (value: unknown) =>
      Buffer.from(JSON.stringify(value)).toString("base64url");
    return `${part({ alg: "RS256" })}.${part(claims)}.signature`;
  }

  const good = {
    iss: "https://accounts.google.com",
    aud: CLIENT,
    exp: Math.floor(NOW.getTime() / 1000) + 600,
    email: "Second@Gmail.com",
    email_verified: true,
  };

  it("reads the address, lowercased, off a token that is in order", () => {
    expect(googleEmailFromIdToken(token(good), CLIENT, NOW)).toBe("second@gmail.com");
  });

  it("accepts the issuer in either of the two spellings Google uses", () => {
    expect(
      googleEmailFromIdToken(token({ ...good, iss: "accounts.google.com" }), CLIENT, NOW)
    ).toBe("second@gmail.com");
  });

  it("refuses a token issued by anybody else", () => {
    expect(
      googleEmailFromIdToken(token({ ...good, iss: "https://evil.example" }), CLIENT, NOW)
    ).toBeNull();
  });

  it("refuses a token issued for another app", () => {
    expect(
      googleEmailFromIdToken(token({ ...good, aud: "somebody.else" }), CLIENT, NOW)
    ).toBeNull();
  });

  it("refuses one that has expired", () => {
    const expired = { ...good, exp: Math.floor(NOW.getTime() / 1000) - 1 };
    expect(googleEmailFromIdToken(token(expired), CLIENT, NOW)).toBeNull();
  });

  it("refuses an address Google has not confirmed", () => {
    /*
      The whole point of what happens next is that holding the address proves
      something. An unconfirmed address on a Google account proves nothing:
      anybody can put anybody's address on one.
    */
    expect(
      googleEmailFromIdToken(token({ ...good, email_verified: false }), CLIENT, NOW)
    ).toBeNull();
  });

  it("takes the string spelling of confirmed, which some Google responses use", () => {
    expect(
      googleEmailFromIdToken(token({ ...good, email_verified: "true" }), CLIENT, NOW)
    ).toBe("second@gmail.com");
  });

  it("refuses a token with no address on it at all", () => {
    expect(googleEmailFromIdToken(token({ ...good, email: undefined }), CLIENT, NOW))
      .toBeNull();
  });

  it("refuses anything that is not a token", () => {
    expect(readIdTokenClaims("not.a.token")).toBeNull();
    expect(readIdTokenClaims("two.parts")).toBeNull();
    expect(googleEmailFromIdToken("", CLIENT, NOW)).toBeNull();
  });

  it("refuses everything when the app holds no client id", () => {
    // An empty client id must never match an empty audience claim.
    expect(googleEmailFromIdToken(token({ ...good, aud: "" }), "", NOW)).toBeNull();
  });
});
