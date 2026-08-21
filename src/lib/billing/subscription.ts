import type Stripe from "stripe";

/*
  Turning what a payment provider says into what Arena stores.

  Kept pure and out of the file that talks to Stripe, because these are the
  two decisions most worth testing on their own: they decide whether somebody
  who paid keeps what they paid for, and whether somebody who stopped paying
  keeps it too.
*/

export type EntitlementStatus = "active" | "past_due" | "cancelled" | "expired";

/** Stripe's many states, reduced to the four an entitlement has. */
export function mapSubscriptionStatus(
  subscription: Pick<Stripe.Subscription, "status" | "cancel_at_period_end">
): EntitlementStatus {
  switch (subscription.status) {
    case "active":
    case "trialing":
      /*
        Cancelled but paid up until the end of the period. They keep it until
        it runs out, because they paid for it. Cutting somebody off the moment
        they press cancel, having taken their money for the rest of the month,
        is how a click-to-cancel flow turns into a complaint.
      */
      return subscription.cancel_at_period_end ? "cancelled" : "active";

    case "past_due":
    case "unpaid":
      /*
        Marked, not revoked. Stripe retries a failed card for days, and taking
        the subscription away on the first failure turns a renewal that would
        have succeeded into a lost subscriber.
      */
      return "past_due";

    case "canceled":
    case "incomplete_expired":
      return "expired";

    default:
      // incomplete, paused, or anything Stripe adds after this was written.
      // Not entitled is the safe direction for a state nobody has considered.
      return "expired";
  }
}

/**
 * When the entitlement should stop.
 *
 * An expired subscription ends now. A live one ends when the period it has
 * been paid for does, wherever Stripe happens to be reporting that: the field
 * has moved from the subscription onto its line items, and reading only the
 * old place would quietly grant everybody an entitlement that never expires.
 */
export function subscriptionEnd(subscription: Stripe.Subscription): string | null {
  if (mapSubscriptionStatus(subscription) === "expired") {
    return new Date().toISOString();
  }

  const withPeriod = subscription as unknown as {
    current_period_end?: number;
    items?: { data?: { current_period_end?: number }[] };
  };

  const seconds =
    withPeriod.current_period_end ??
    withPeriod.items?.data?.[0]?.current_period_end ??
    null;

  return seconds ? new Date(seconds * 1000).toISOString() : null;
}
