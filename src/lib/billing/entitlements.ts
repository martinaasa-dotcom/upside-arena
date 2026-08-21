import "server-only";

import { canWriteGame } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { PLUS, limitsFor, type Limits } from "@/lib/billing/plan";

/*
  What somebody is entitled to, and what that means in the game.

  Read from the database rather than from a payment provider on every request,
  as section 9 asks. A provider being slow, down, or having changed its API
  must never be able to take away something a player has paid for.
*/

export type Standing = {
  hasPlus: boolean;
  /** 'cancelled' means paid up until it runs out, which is still entitled. */
  status: "none" | "active" | "past_due" | "cancelled";
  until: string | null;
  limits: Limits;
  coins: number;
};

export const FREE_STANDING: Standing = {
  hasPlus: false,
  status: "none",
  until: null,
  limits: limitsFor(false),
  coins: 0,
};

export async function getStanding(userId: string): Promise<Standing> {
  if (!canWriteGame) return FREE_STANDING;

  const admin = createAdminClient();

  const [{ data: rows }, { data: balance }] = await Promise.all([
    admin
      .from("entitlements")
      .select("status, expires_at")
      .eq("user_id", userId)
      .eq("product", PLUS)
      .maybeSingle(),
    admin.from("coin_balances").select("balance").eq("user_id", userId).maybeSingle(),
  ]);

  const row = rows as { status: string; expires_at: string | null } | null;
  const coins = (balance as { balance: number } | null)?.balance ?? 0;

  if (!row) return { ...FREE_STANDING, coins };

  const live =
    (row.status === "active" || row.status === "cancelled") &&
    (row.expires_at == null || new Date(row.expires_at) > new Date());

  return {
    hasPlus: live,
    status: row.status as Standing["status"],
    until: row.expires_at,
    limits: limitsFor(live),
    coins,
  };
}

/** Just the answer, for the places that only need to know yes or no. */
export async function hasPlus(userId: string): Promise<boolean> {
  if (!canWriteGame) return false;

  const admin = createAdminClient();
  const { data } = await admin.rpc("has_entitlement", {
    p_user_id: userId,
    p_product: PLUS,
  });

  return data === true;
}

export async function grantEntitlement(args: {
  userId: string;
  product: string;
  source: "stripe" | "apple" | "google" | "gift";
  status: "active" | "past_due" | "cancelled" | "expired";
  externalRef?: string | null;
  expiresAt?: string | null;
}): Promise<boolean> {
  if (!canWriteGame) return false;

  const admin = createAdminClient();
  const { error } = await admin.rpc("grant_entitlement", {
    p_user_id: args.userId,
    p_product: args.product,
    p_source: args.source,
    p_status: args.status,
    p_external_ref: args.externalRef ?? null,
    p_expires_at: args.expiresAt ?? null,
  });

  return !error;
}

/** The coin ledger, newest first, for the page that shows where they went. */
export async function getCoinHistory(userId: string, limit = 20) {
  if (!canWriteGame) return [];

  const admin = createAdminClient();
  const { data } = await admin
    .from("coin_ledger")
    .select("id, delta, balance_after, reason, detail, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data ?? []) as {
    id: string;
    delta: number;
    balance_after: number;
    reason: string;
    detail: string | null;
    created_at: string;
  }[];
}

export type PurchaseOutcome =
  | { ok: true; balance: number }
  | { ok: false; error: string };

/**
 * Buys one cosmetic with coins.
 *
 * The balance check, the deduction, the ledger line and the item all happen
 * inside one database function, in one transaction. Split apart it would be
 * possible to be charged and get nothing.
 */
export async function buyReward(
  userId: string,
  rewardId: string
): Promise<PurchaseOutcome> {
  if (!canWriteGame) return { ok: false, error: "The shop is not open yet." };

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("buy_reward", {
    p_user_id: userId,
    p_reward_id: rewardId,
  });

  if (error) {
    const message = error.message ?? "";
    if (message.includes("not enough coins")) {
      return { ok: false, error: "You do not have enough coins for that yet." };
    }
    if (message.includes("already own")) {
      return { ok: false, error: "You already have that one." };
    }
    if (message.includes("not for sale")) {
      return { ok: false, error: "That one is not for sale." };
    }
    return { ok: false, error: "We could not complete that. Nothing was taken." };
  }

  return { ok: true, balance: typeof data === "number" ? data : 0 };
}

/** Credits bought coins. Safe to call again with the same key. */
export async function addCoins(args: {
  userId: string;
  amount: number;
  reason: "purchase" | "gift" | "refund";
  idempotencyKey: string;
  detail?: string | null;
}): Promise<boolean> {
  if (!canWriteGame) return false;

  const admin = createAdminClient();
  const { error } = await admin.rpc("add_coins", {
    p_user_id: args.userId,
    p_amount: args.amount,
    p_reason: args.reason,
    p_idempotency_key: args.idempotencyKey,
    p_detail: args.detail ?? null,
  });

  return !error;
}
