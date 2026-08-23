import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { canWriteGame } from "@/lib/env";
import { playerCache } from "@/lib/game/cache";
import { normalizeEmail } from "@/lib/auth/email-address";
import {
  decideClaim,
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
