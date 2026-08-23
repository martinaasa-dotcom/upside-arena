import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { canWriteGame, siteUrl } from "@/lib/env";
import { playerCache } from "@/lib/game/cache";
import { normalizeEmail } from "@/lib/auth/email-address";
import { confirmAddressMail, linkedSignInMail } from "@/lib/auth/link-mail";
import { emailConfigured, sendTransactionalEmail } from "@/lib/notify/send";
import {
  decideClaim,
  hashLinkToken,
  linkUrl,
  mintLinkToken,
  type AddressOutcome,
  type ClaimVerdict,
} from "@/lib/auth/address-link";

/*
  The addresses that reach one account, and everything that talks to the
  database about them.

  The rules live next door in address-link.ts, where they can be tested without
  a project. This file is the plumbing: the table, the two questions only the
  service role may ask about auth.users, and the mail.

  Every write here goes through the service role, on purpose. Adding an address
  is the one thing that has to check what the address already reaches, and a
  check a client runs on its own behalf is not a check. The client may do
  exactly one thing to this table, which is take an address off its own
  account, and row level security is what says so.
*/

export type LinkedAddress = {
  id: string;
  email: string;
  /** False while the confirmation is still sitting in that mailbox. */
  verified: boolean;
  addedAt: string;
};

/**
 * Every extra address on an account, confirmed or still waiting.
 *
 * Cached as the player's, like every other read the profile screen makes, so
 * the room arrives holding this rather than streaming it in after the tap.
 * That is also why it reads with the service role and takes the account as an
 * argument: a cached read cannot touch the cookie the session client is built
 * from. Both actions that change this list drop the player's tag.
 */
export async function listAddresses(userId: string): Promise<LinkedAddress[]> {
  "use cache";
  playerCache(userId);

  if (!canWriteGame) return [];

  const admin = createAdminClient();

  const { data, error } = await admin
    .from("account_emails")
    .select("id, email, verified_at, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id,
    email: row.email,
    verified: row.verified_at != null,
    addedAt: row.created_at,
  }));
}

/**
 * The account a confirmed address reaches, and the address that account was
 * made with.
 *
 * Asked before any sign-in link is sent and before any Google identity is
 * turned into a session. Null means what it has always meant: this address is
 * whoever Supabase says it is.
 */
export async function accountForAddress(
  rawEmail: string
): Promise<{ userId: string; primaryEmail: string } | null> {
  if (!canWriteGame) return null;

  const email = normalizeEmail(rawEmail);
  if (!email) return null;

  const admin = createAdminClient();

  const { data } = await admin
    .from("account_emails")
    .select("user_id")
    .eq("email", email)
    .not("verified_at", "is", null)
    .maybeSingle();

  if (!data?.user_id) return null;

  const { data: found, error } = await admin.auth.admin.getUserById(data.user_id);
  const primaryEmail = found?.user?.email;

  /*
    An account whose auth user is gone should never be here, because the row
    cascades with it. If it somehow is, the safe answer is not to know this
    address rather than to hand a session to a row pointing at nothing.
  */
  if (error || !primaryEmail) return null;

  return { userId: data.user_id, primaryEmail };
}

/*
  A one-time token that opens one account, made without sending anything.

  This is how an address that was added reaches the account it was added to.
  Supabase mints the token for the account's own address, Arena puts it in a
  link and either mails that link to the other address or, when Google has
  just proved who somebody is, spends it on the spot. Either way the session
  that comes out belongs to the account, and no second auth user is ever made.
*/
export async function magicTokenFor(primaryEmail: string): Promise<string | null> {
  if (!canWriteGame) return null;

  const admin = createAdminClient();

  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: primaryEmail,
  });

  if (error) {
    console.error("could not mint a sign-in token for a linked address", error.message);
    return null;
  }

  return data?.properties?.hashed_token ?? null;
}

/** The confirm url a hashed token opens, which is the same one Supabase mails. */
export function confirmUrlFor(tokenHash: string, next: string): string {
  const query = new URLSearchParams({
    token_hash: tokenHash,
    type: "magiclink",
    next,
  });

  return `${siteUrl()}/auth/confirm?${query.toString()}`;
}

/**
 * Sends a sign-in link to an address that was added to an account.
 *
 * Arena sends this one rather than Supabase, because Supabase would send it to
 * the address the account was made with, which is not the mailbox the person
 * is sitting in front of.
 */
export async function sendLinkedSignIn(
  address: string,
  primaryEmail: string,
  next: string
): Promise<boolean> {
  if (!emailConfigured) return false;

  const tokenHash = await magicTokenFor(primaryEmail);
  if (!tokenHash) return false;

  return sendTransactionalEmail(
    address,
    linkedSignInMail(confirmUrlFor(tokenHash, next))
  );
}

/*
  What the account asking already has, and what the address already reaches.
  Four questions, asked together, so the verdict next door has everything.
*/
async function claimVerdict(
  me: string,
  primaryEmail: string | null,
  email: string
): Promise<ClaimVerdict> {
  const admin = createAdminClient();

  const [linked, mine, login] = await Promise.all([
    admin
      .from("account_emails")
      .select("user_id, verified_at")
      .eq("email", email)
      .maybeSingle(),
    admin
      .from("account_emails")
      .select("id", { count: "exact", head: true })
      .eq("user_id", me)
      .neq("email", email),
    admin.rpc("account_for_login_email", { p_email: email }),
  ]);

  const loginAccount = (login.data as string | null) ?? null;

  let neverPlayed = false;
  if (loginAccount && loginAccount !== me) {
    const { data } = await admin.rpc("account_never_played", { p_user: loginAccount });
    neverPlayed = data === true;
  }

  return decideClaim({
    me,
    email,
    primaryEmail,
    linked: linked.data
      ? { account: linked.data.user_id, verified: linked.data.verified_at != null }
      : null,
    loginAccount,
    neverPlayed,
    linkedCount: mine.count ?? 0,
  });
}

export type LinkStart =
  | { kind: "sent"; email: string; closes: boolean }
  | { kind: "already" }
  | { kind: "error"; code: AddressOutcome };

/**
 * Starts adding an address: writes it down as pending and mails it a link.
 *
 * Nothing is joined here. The row this leaves behind reaches no account and
 * signs nobody in until the link in that mailbox is opened, which is the only
 * proof that the person asking can read it.
 */
export async function startAddressLink(input: {
  userId: string;
  primaryEmail: string | null;
  email: string;
}): Promise<LinkStart> {
  if (!canWriteGame) return { kind: "error", code: "not-configured" };
  if (!emailConfigured) return { kind: "error", code: "no-mail" };

  const email = normalizeEmail(input.email);
  const admin = createAdminClient();

  /*
    A pending row nobody ever confirmed holds an address hostage, because the
    table allows one row per address whatever its state. An expired one is
    worth nothing to the account that started it, so it goes rather than
    standing in the way of somebody who is asking now.
  */
  await admin
    .from("account_emails")
    .delete()
    .eq("email", email)
    .is("verified_at", null)
    .lt("token_expires_at", new Date().toISOString());

  const verdict = await claimVerdict(input.userId, input.primaryEmail, email);

  if (verdict.kind === "already") return { kind: "already" };
  if (verdict.kind === "refuse") return { kind: "error", code: verdict.code };

  const token = mintLinkToken();

  /*
    One row per address per account, so asking again sends a fresh link rather
    than filling the table with tokens that all open the same thing. The old
    token stops working the moment this lands, which is what somebody who
    clicked "send it again" expects.
  */
  await admin
    .from("account_emails")
    .delete()
    .eq("email", email)
    .eq("user_id", input.userId)
    .is("verified_at", null);

  const { error } = await admin.from("account_emails").insert({
    user_id: input.userId,
    email,
    token_hash: token.hash,
    token_expires_at: token.expiresAt,
    verified_at: null,
  });

  if (error) {
    /*
      The unique index on the address, reached by two people asking for the
      same one in the same breath. It is the same answer the verdict above
      gives, arrived at a moment later, so it reads the same way.
    */
    if (error.code === "23505") return { kind: "error", code: "linked-elsewhere" };

    console.error("could not record a pending address", error.message);
    return { kind: "error", code: "failed" };
  }

  const sent = await sendTransactionalEmail(
    email,
    confirmAddressMail(linkUrl(siteUrl(), token.token), input.primaryEmail)
  );

  if (!sent) {
    await admin
      .from("account_emails")
      .delete()
      .eq("email", email)
      .eq("user_id", input.userId)
      .is("verified_at", null);

    return { kind: "error", code: "failed" };
  }

  return { kind: "sent", email, closes: verdict.kind === "adopt" };
}

export type LinkConfirmation =
  | { kind: "linked"; email: string }
  | { kind: "fail"; reason: string };

/**
 * The other end of that link.
 *
 * Every check runs again here rather than being trusted from when the mail was
 * sent. An hour is long enough for the address to have been claimed by
 * somebody else, and the answer that matters is the one true at the moment the
 * address is actually joined.
 */
export async function confirmAddressLink(token: string): Promise<LinkConfirmation> {
  if (!canWriteGame) return { kind: "fail", reason: "not-configured" };

  const admin = createAdminClient();
  const hash = hashLinkToken(token);

  const { data: pending } = await admin
    .from("account_emails")
    .select("id, user_id, email, token_expires_at, verified_at")
    .eq("token_hash", hash)
    .maybeSingle();

  if (!pending || pending.verified_at) return { kind: "fail", reason: "expired" };

  if (!pending.token_expires_at || new Date(pending.token_expires_at) < new Date()) {
    await admin.from("account_emails").delete().eq("id", pending.id);
    return { kind: "fail", reason: "expired" };
  }

  const { data: loginAccount } = await admin.rpc("account_for_login_email", {
    p_email: pending.email,
  });

  const other = (loginAccount as string | null) ?? null;

  if (other && other !== pending.user_id) {
    const { data: never } = await admin.rpc("account_never_played", { p_user: other });

    if (never !== true) {
      await admin.from("account_emails").delete().eq("id", pending.id);
      return { kind: "fail", reason: "address-taken" };
    }

    /*
      The empty account on this address, closed so the address can reach the
      one the person actually plays on. It has no tag, no week, no league and
      nothing bought, which the database decided rather than this file, and
      whoever is holding this link has just proved they can read the mailbox it
      was made with.
    */
    const { error } = await admin.auth.admin.deleteUser(other);

    if (error) {
      console.error("could not close the empty account on a linked address", error.message);
      return { kind: "fail", reason: "address-taken" };
    }
  }

  const { error } = await admin
    .from("account_emails")
    .update({ verified_at: new Date().toISOString(), token_hash: null, token_expires_at: null })
    .eq("id", pending.id);

  if (error) {
    console.error("could not confirm an address", error.message);
    return { kind: "fail", reason: "link-failed" };
  }

  return { kind: "linked", email: pending.email };
}

export type GoogleLink =
  | { kind: "linked"; email: string }
  | { kind: "already" }
  | { kind: "fail"; code: AddressOutcome };

/**
 * Adds the address on a Google account somebody just signed in with, to the
 * account they are already signed in to.
 *
 * No mail and no waiting: Google has this second confirmed, and the handshake
 * that carried it is the same one Arena signs people in with. The address goes
 * down confirmed, because a confirmation link to a mailbox whose owner just
 * proved they hold it would be asking the same question twice.
 */
export async function connectGoogleAddress(input: {
  userId: string;
  primaryEmail: string | null;
  email: string;
}): Promise<GoogleLink> {
  if (!canWriteGame) return { kind: "fail", code: "not-configured" };

  const email = normalizeEmail(input.email);
  const admin = createAdminClient();

  await admin
    .from("account_emails")
    .delete()
    .eq("email", email)
    .is("verified_at", null)
    .lt("token_expires_at", new Date().toISOString());

  const verdict = await claimVerdict(input.userId, input.primaryEmail, email);

  if (verdict.kind === "already") return { kind: "already" };
  if (verdict.kind === "refuse") return { kind: "fail", code: verdict.code };

  if (verdict.kind === "adopt") {
    const { error } = await admin.auth.admin.deleteUser(verdict.account);

    if (error) {
      console.error("could not close the empty account on a linked address", error.message);
      return { kind: "fail", code: "has-record" };
    }
  }

  await admin
    .from("account_emails")
    .delete()
    .eq("email", email)
    .eq("user_id", input.userId)
    .is("verified_at", null);

  const { error } = await admin.from("account_emails").insert({
    user_id: input.userId,
    email,
    token_hash: null,
    token_expires_at: null,
    verified_at: new Date().toISOString(),
  });

  if (error) {
    if (error.code === "23505") return { kind: "fail", code: "linked-elsewhere" };

    console.error("could not connect a Google address", error.message);
    return { kind: "fail", code: "failed" };
  }

  return { kind: "linked", email };
}
