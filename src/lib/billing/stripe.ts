import "server-only";

import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { canWriteGame, siteUrl } from "@/lib/env";
import { COIN_BUNDLES, PLUS, bundle } from "@/lib/billing/plan";
import { addCoins, grantEntitlement } from "@/lib/billing/entitlements";
import {
  mapSubscriptionStatus,
  subscriptionEnd,
} from "@/lib/billing/subscription";

/*
  Stripe, kept behind one file.

  Everything Arena knows about being paid lives in the entitlements table, and
  that table is keyed by person and product rather than by a Stripe id. So
  this file's whole job is to turn Stripe's language into a row there, and
  nothing outside it ever asks Stripe a question in order to render a page.

  With no keys configured nothing here works and nothing here breaks: the
  paid screens say so plainly and the free game is untouched. Payments are
  not something the game depends on.
*/

const SECRET_KEY = process.env.STRIPE_SECRET_KEY ?? "";
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? "";

/** The recurring price, made in the Stripe dashboard and referenced by id. */
const PLUS_PRICE_ID = process.env.STRIPE_PLUS_PRICE_ID ?? "";

export const stripeConfigured = Boolean(SECRET_KEY && WEBHOOK_SECRET);
export const subscriptionConfigured = Boolean(stripeConfigured && PLUS_PRICE_ID);

let client: Stripe | null = null;

function stripe(): Stripe {
  if (!SECRET_KEY) throw new Error("Stripe is not configured");
  client ??= new Stripe(SECRET_KEY, {
    // Pinned. An API version that moves under a running deployment is a
    // payment system that changes behaviour without a deploy.
    apiVersion: "2026-07-29.dahlia",
    appInfo: { name: "Upside Arena" },
  });
  return client;
}

/**
 * The Stripe customer for this player, made once and remembered.
 *
 * Kept in our own table rather than searched for by email each time. Email is
 * changeable and not unique in Stripe, so looking one up by it is how two
 * customers end up sharing a subscription.
 */
async function customerFor(userId: string, email: string | null): Promise<string> {
  const admin = createAdminClient();

  const { data } = await admin
    .from("billing_customers")
    .select("customer_id")
    .eq("user_id", userId)
    .maybeSingle();

  const existing = (data as { customer_id: string } | null)?.customer_id;
  if (existing) return existing;

  const customer = await stripe().customers.create(
    {
      email: email ?? undefined,
      // The only place the link between the two systems is written down.
      metadata: { arena_user_id: userId },
    },
    // A retried request must not create a second customer.
    { idempotencyKey: `customer:${userId}` }
  );

  await admin.rpc("link_billing_customer", {
    p_user_id: userId,
    p_customer_id: customer.id,
  });

  return customer.id;
}

export type CheckoutResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

/** Starts the subscription checkout. */
export async function startPlusCheckout(
  userId: string,
  email: string | null
): Promise<CheckoutResult> {
  if (!subscriptionConfigured || !canWriteGame) {
    return { ok: false, error: "Arena Plus is not on sale yet." };
  }

  try {
    const customer = await customerFor(userId, email);

    const session = await stripe().checkout.sessions.create({
      mode: "subscription",
      customer,
      line_items: [{ price: PLUS_PRICE_ID, quantity: 1 }],
      // Sales tax and VAT worked out by Stripe rather than by us.
      automatic_tax: { enabled: true },
      customer_update: { address: "auto" },
      client_reference_id: userId,
      metadata: { arena_user_id: userId, product: PLUS },
      subscription_data: { metadata: { arena_user_id: userId } },
      success_url: `${siteUrl()}/plus?welcome=1`,
      cancel_url: `${siteUrl()}/plus`,
    });

    if (!session.url) return { ok: false, error: "Stripe did not return a page." };
    return { ok: true, url: session.url };
  } catch {
    return { ok: false, error: "We could not open the payment page. Try again." };
  }
}

/** Starts a one-off coin purchase. */
export async function startCoinCheckout(
  userId: string,
  email: string | null,
  bundleId: string
): Promise<CheckoutResult> {
  if (!stripeConfigured || !canWriteGame) {
    return { ok: false, error: "Coins are not on sale yet." };
  }

  const chosen = bundle(bundleId);
  // The price comes from our own list, never from the request. A bundle id
  // that is not ours is refused rather than charged for.
  if (!chosen) return { ok: false, error: "That is not one of the bundles." };

  try {
    const customer = await customerFor(userId, email);

    const session = await stripe().checkout.sessions.create({
      mode: "payment",
      customer,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: chosen.currency,
            unit_amount: chosen.amount,
            /*
              The price shown is the price paid. Selling to consumers in the
              EU, VAT has to be included in the advertised figure rather than
              added at the end, and a bundle that says 1.99 and charges 2.45
              is the kind of surprise that produces a chargeback rather than a
              second purchase.

              Stripe also requires this explicitly once automatic tax is on
              and the price is defined inline, so leaving it to the account
              default is a checkout that fails to open.
            */
            tax_behavior: "inclusive",
            product_data: {
              name: `Upside Arena, ${chosen.label}`,
              description:
                "Coins buy decoration only. Not money, not refundable once spent, and never affect a score.",
            },
          },
        },
      ],
      automatic_tax: { enabled: true },
      customer_update: { address: "auto" },
      client_reference_id: userId,
      metadata: { arena_user_id: userId, bundle: chosen.id, coins: String(chosen.coins) },
      success_url: `${siteUrl()}/plus?coins=1`,
      cancel_url: `${siteUrl()}/plus`,
    });

    if (!session.url) return { ok: false, error: "Stripe did not return a page." };
    return { ok: true, url: session.url };
  } catch {
    return { ok: false, error: "We could not open the payment page. Try again." };
  }
}

/**
 * The customer portal, which is where cancelling happens.
 *
 * Cancelling has to be as easy as subscribing, and this is what makes that
 * true without building anything. There is deliberately no "email us to
 * cancel" path anywhere in Arena.
 */
export async function openBillingPortal(userId: string): Promise<CheckoutResult> {
  if (!stripeConfigured || !canWriteGame) {
    return { ok: false, error: "There is nothing to manage yet." };
  }

  const admin = createAdminClient();
  const { data } = await admin
    .from("billing_customers")
    .select("customer_id")
    .eq("user_id", userId)
    .maybeSingle();

  const customer = (data as { customer_id: string } | null)?.customer_id;
  if (!customer) return { ok: false, error: "There is nothing to manage yet." };

  try {
    const session = await stripe().billingPortal.sessions.create({
      customer,
      return_url: `${siteUrl()}/plus`,
    });
    return { ok: true, url: session.url };
  } catch {
    return { ok: false, error: "We could not open the billing page. Try again." };
  }
}

/*
  Webhooks.

  Verified by signature before anything is read out of the body, because an
  unverified webhook body is a request from a stranger claiming somebody paid.
  Then claimed in the database before it is acted on, because Stripe retries
  until it is acknowledged and a retry must not be a replay.
*/

export type WebhookOutcome = {
  handled: boolean;
  kind: string;
  detail?: string;
};

export function verifyWebhook(body: string, signature: string | null): Stripe.Event {
  if (!stripeConfigured) throw new Error("Stripe is not configured");
  if (!signature) throw new Error("No signature");

  // Throws on a bad signature, a missing timestamp, or one old enough to be a
  // replay. Nothing below runs until it has returned.
  return stripe().webhooks.constructEvent(body, signature, WEBHOOK_SECRET);
}

/** The Arena account behind a Stripe object, without trusting an email. */
async function userFor(
  candidateId: string | null | undefined,
  customerId: string | null | undefined
): Promise<string | null> {
  if (candidateId) return candidateId;
  if (!customerId) return null;

  const admin = createAdminClient();
  const { data } = await admin
    .from("billing_customers")
    .select("user_id")
    .eq("customer_id", customerId)
    .maybeSingle();

  return (data as { user_id: string } | null)?.user_id ?? null;
}

function asId(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "id" in value) {
    const id = (value as { id: unknown }).id;
    return typeof id === "string" ? id : null;
  }
  return null;
}

export async function handleWebhook(event: Stripe.Event): Promise<WebhookOutcome> {
  const admin = createAdminClient();

  // Claimed before it is acted on, so a redelivery does nothing at all.
  const { data: fresh } = await admin.rpc("claim_billing_event", {
    p_id: event.id,
    p_kind: event.type,
  });

  if (fresh !== true) return { handled: true, kind: event.type, detail: "already seen" };

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;

      // Only a session that was actually paid for. An unpaid one can complete.
      if (session.payment_status !== "paid" && session.mode === "payment") {
        return { handled: true, kind: event.type, detail: "not paid" };
      }

      const userId = await userFor(
        session.client_reference_id ?? session.metadata?.arena_user_id,
        asId(session.customer)
      );
      if (!userId) return { handled: false, kind: event.type, detail: "no account" };

      if (session.mode === "payment") {
        const chosen = bundle(session.metadata?.bundle ?? "");
        if (!chosen) return { handled: false, kind: event.type, detail: "unknown bundle" };

        /*
          Keyed on the session rather than on the event. Stripe can report the
          same completed checkout through more than one event type, and both
          would otherwise credit it.
        */
        await addCoins({
          userId,
          amount: chosen.coins,
          reason: "purchase",
          idempotencyKey: `stripe:${session.id}`,
          detail: chosen.id,
        });

        return { handled: true, kind: event.type, detail: `${chosen.coins} coins` };
      }

      // A subscription checkout is confirmed by the subscription events that
      // follow it, so there is nothing to grant here.
      return { handled: true, kind: event.type, detail: "subscription started" };
    }

    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;

      const userId = await userFor(
        subscription.metadata?.arena_user_id,
        asId(subscription.customer)
      );
      if (!userId) return { handled: false, kind: event.type, detail: "no account" };

      const status = mapSubscriptionStatus(subscription);
      const endsAt = subscriptionEnd(subscription);

      await grantEntitlement({
        userId,
        product: PLUS,
        source: "stripe",
        status,
        externalRef: subscription.id,
        expiresAt: endsAt,
      });

      return { handled: true, kind: event.type, detail: status };
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const userId = await userFor(null, asId(invoice.customer));
      if (!userId) return { handled: false, kind: event.type, detail: "no account" };

      /*
        Marked, not revoked. Stripe retries a failed payment for days, and
        taking somebody's subscription away on the first failed card is how a
        renewal that would have succeeded turns into a cancellation.
      */
      await grantEntitlement({
        userId,
        product: PLUS,
        source: "stripe",
        status: "past_due",
        expiresAt: null,
      });

      return { handled: true, kind: event.type, detail: "past due" };
    }

    default:
      return { handled: true, kind: event.type, detail: "ignored" };
  }
}

export { COIN_BUNDLES };
export { mapSubscriptionStatus, subscriptionEnd };
