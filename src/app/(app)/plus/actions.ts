"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  openBillingPortal,
  startCoinCheckout,
  startPlusCheckout,
} from "@/lib/billing/stripe";
import { buyReward } from "@/lib/billing/entitlements";
import { PLUS_CADENCES, type PlusCadence } from "@/lib/billing/plan";
import { playerChanged } from "@/lib/game/cache";

/*
  Starting a payment, and managing one already running.

  Every one of these ends in a redirect to Stripe rather than in a form Arena
  hosts. Card details never touch this application, which is both the cheapest
  way to be safe and the only way to stay out of scope for handling them.
*/

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");
  return user;
}

export type StartResult = { ok: false; error: string };

function asCadence(value: string): PlusCadence {
  // Anything unrecognised falls back to the monthly price rather than being
  // handed to Stripe. A cadence arrives from a browser like any other input.
  return (PLUS_CADENCES as readonly string[]).includes(value)
    ? (value as PlusCadence)
    : "monthly";
}

export async function startSubscription(
  cadence: string = "monthly"
): Promise<StartResult> {
  const user = await requireUser();
  const result = await startPlusCheckout(
    user.id,
    user.email ?? null,
    asCadence(cadence)
  );

  // A successful start is a redirect, so it never returns.
  if (result.ok) redirect(result.url);
  return { ok: false, error: result.error };
}

export async function startCoinPurchase(bundleId: string): Promise<StartResult> {
  const user = await requireUser();
  const result = await startCoinCheckout(user.id, user.email ?? null, bundleId);

  if (result.ok) redirect(result.url);
  return { ok: false, error: result.error };
}

/**
 * Cancelling, and everything else about the subscription.
 *
 * Stripe's own portal, because cancelling has to be as easy as subscribing.
 * There is no path in Arena that asks somebody to email us to stop paying.
 */
export async function manageSubscription(): Promise<StartResult> {
  const user = await requireUser();
  const result = await openBillingPortal(user.id);

  if (result.ok) redirect(result.url);
  return { ok: false, error: result.error };
}

export async function purchaseReward(
  rewardId: string
): Promise<{ ok: boolean; error?: string; balance?: number }> {
  const user = await requireUser();
  const result = await buyReward(user.id, rewardId);

  playerChanged(user.id);
  revalidatePath("/plus");
  playerChanged(user.id);
  revalidatePath("/profile");

  return result.ok
    ? { ok: true, balance: result.balance }
    : { ok: false, error: result.error };
}
