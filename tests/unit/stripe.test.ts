import { describe, expect, it } from "vitest";
import Stripe from "stripe";
import { mapSubscriptionStatus, subscriptionEnd } from "@/lib/billing/subscription";
import {
  COIN_BUNDLES,
  FREE,
  PLUS_CADENCES,
  PLUS_LIMITS,
  PLUS_PLANS,
  perMonth,
  yearlySaving,
  bundle,
  formatPrice,
  limitsFor,
} from "@/lib/billing/plan";

/*
  The two things a payment system must not get wrong.

  A webhook accepted without a valid signature means anybody can grant
  themselves a paid subscription by posting some JSON. And an entitlement that
  expires at the wrong moment means somebody who paid loses what they paid for,
  or somebody who stopped paying keeps it.

  The signature scheme is checked against Stripe's own verifier here, using its
  own test-header generator, so this tests the real thing rather than a
  reimplementation of it.
*/

const SECRET = "whsec_test_secret_for_verifying_only";

function payload(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    id: "evt_1",
    object: "event",
    type: "customer.subscription.updated",
    data: { object: { id: "sub_1" } },
    ...overrides,
  });
}

function sign(body: string, opts: { timestamp?: number; secret?: string } = {}) {
  return Stripe.webhooks.generateTestHeaderString({
    payload: body,
    secret: opts.secret ?? SECRET,
    timestamp: opts.timestamp,
  });
}

/*
  Verified through Stripe's own object rather than through Arena's wrapper,
  because the wrapper refuses to run at all without keys in the environment.
  The scheme under test is identical.
*/
const verifier = new Stripe("sk_test_not_a_real_key", {
  apiVersion: "2026-07-29.dahlia",
});

function verify(body: string, header: string, tolerance?: number) {
  return verifier.webhooks.constructEvent(body, header, SECRET, tolerance);
}

describe("verifying that a webhook really came from Stripe", () => {
  it("accepts a correctly signed body", () => {
    const body = payload();
    const event = verify(body, sign(body));
    expect(event.id).toBe("evt_1");
  });

  it("refuses a body signed with somebody else's secret", () => {
    // The whole paid tier would be free if this passed.
    const body = payload();
    expect(() => verify(body, sign(body, { secret: "whsec_wrong" }))).toThrow();
  });

  it("refuses a body that was changed after it was signed", () => {
    const body = payload();
    const header = sign(body);

    const tampered = payload({ type: "checkout.session.completed" });
    expect(() => verify(tampered, header)).toThrow();
  });

  it("refuses a signature that has been replayed hours later", () => {
    // An old but genuine signature is exactly what an attacker who once saw
    // one would send.
    const body = payload();
    const old = Math.floor(Date.now() / 1000) - 60 * 60 * 6;
    expect(() => verify(body, sign(body, { timestamp: old }), 300)).toThrow();
  });

  it("refuses a missing or malformed signature header", () => {
    const body = payload();
    expect(() => verify(body, "")).toThrow();
    expect(() => verify(body, "t=1,v1=nonsense")).toThrow();
    expect(() => verify(body, "not-a-header")).toThrow();
  });

  it("refuses a body that only differs by whitespace", () => {
    // Which is why the route reads the raw body rather than parsing and
    // re-serialising it: this is what that would produce.
    const body = payload();
    const header = sign(body);
    expect(() => verify(JSON.stringify(JSON.parse(body), null, 2), header)).toThrow();
  });
});

describe("turning a Stripe subscription into an entitlement", () => {
  it("treats an active subscription as active", () => {
    expect(
      mapSubscriptionStatus({ status: "active", cancel_at_period_end: false })
    ).toBe("active");
  });

  it("treats a trial as active, because they are using it", () => {
    expect(
      mapSubscriptionStatus({ status: "trialing", cancel_at_period_end: false })
    ).toBe("active");
  });

  it("keeps a cancelled but paid-up subscription entitled", () => {
    // Cutting somebody off the moment they press cancel, having taken their
    // money for the rest of the month, is how a click-to-cancel flow becomes
    // a complaint.
    expect(
      mapSubscriptionStatus({ status: "active", cancel_at_period_end: true })
    ).toBe("cancelled");
  });

  it("marks a failed payment as past due rather than revoking it", () => {
    // Stripe retries a failed card for days. Revoking on the first failure
    // turns a renewal that would have worked into a lost subscriber.
    expect(
      mapSubscriptionStatus({ status: "past_due", cancel_at_period_end: false })
    ).toBe("past_due");
    expect(
      mapSubscriptionStatus({ status: "unpaid", cancel_at_period_end: false })
    ).toBe("past_due");
  });

  it("expires a subscription Stripe has finished with", () => {
    expect(
      mapSubscriptionStatus({ status: "canceled", cancel_at_period_end: false })
    ).toBe("expired");
    expect(
      mapSubscriptionStatus({
        status: "incomplete_expired",
        cancel_at_period_end: false,
      })
    ).toBe("expired");
  });

  it("grants nothing for a state it does not recognise", () => {
    // Including anything Stripe adds after this was written. Not entitled is
    // the safe direction for a status nobody has thought about yet.
    expect(
      mapSubscriptionStatus({
        status: "incomplete" as Stripe.Subscription.Status,
        cancel_at_period_end: false,
      })
    ).toBe("expired");
    expect(
      mapSubscriptionStatus({
        status: "paused" as Stripe.Subscription.Status,
        cancel_at_period_end: false,
      })
    ).toBe("expired");
  });
});

describe("when an entitlement should stop", () => {
  const at = 1_800_000_000;

  function subscription(extra: Record<string, unknown>) {
    return {
      status: "active",
      cancel_at_period_end: false,
      ...extra,
    } as unknown as Stripe.Subscription;
  }

  it("ends when the paid period does", () => {
    expect(subscriptionEnd(subscription({ current_period_end: at }))).toBe(
      new Date(at * 1000).toISOString()
    );
  });

  it("finds the period on the line item when it is not on the subscription", () => {
    // Stripe moved this field. Reading only the old place would silently
    // grant everybody an entitlement that never expires.
    expect(
      subscriptionEnd(
        subscription({ items: { data: [{ current_period_end: at }] } })
      )
    ).toBe(new Date(at * 1000).toISOString());
  });

  it("ends an expired subscription immediately", () => {
    const ended = subscriptionEnd(
      subscription({ status: "canceled", current_period_end: at })
    );

    expect(ended).not.toBeNull();
    expect(new Date(ended as string).getTime()).toBeLessThanOrEqual(Date.now());
  });

  it("has no end date when Stripe gives no period at all", () => {
    // Better than inventing one. The subscription events keep arriving, and
    // the next one carries a date.
    expect(subscriptionEnd(subscription({}))).toBeNull();
  });
});

describe("what money buys", () => {
  it("gives a subscriber more of the things that are conveniences", () => {
    expect(PLUS_LIMITS.weeklyFreezes).toBeGreaterThan(FREE.weeklyFreezes);
    expect(PLUS_LIMITS.leaguesOwned).toBeGreaterThan(FREE.leaguesOwned);
    expect(PLUS_LIMITS.leagueMembers).toBeGreaterThan(FREE.leagueMembers);
  });

  it("hands out the free limits to somebody who has not paid", () => {
    expect(limitsFor(false)).toEqual(FREE);
    expect(limitsFor(true)).toEqual(PLUS_LIMITS);
  });

  it("never changes anything that decides a score", () => {
    /*
      The locked rule from section 9, asserted rather than assumed. If a key
      ever appears here that affects a starting balance, a return, a rank or
      what may be traded, this fails and it should.
    */
    const allowed = [
      "leaguesOwned",
      "leaguesJoined",
      "leagueMembers",
      "weeklyFreezes",
      "deeperStats",
    ];

    expect(Object.keys(FREE).sort()).toEqual([...allowed].sort());
    expect(Object.keys(PLUS_LIMITS).sort()).toEqual([...allowed].sort());
  });
});

describe("coin bundles", () => {
  it("sells a fixed number of coins for a fixed price", () => {
    // Never a bundle whose contents are decided by chance. Banned outright in
    // some countries, and ruled out by section 3 regardless.
    for (const entry of COIN_BUNDLES) {
      expect(entry.coins).toBeGreaterThan(0);
      expect(Number.isInteger(entry.coins)).toBe(true);
      expect(entry.amount).toBeGreaterThan(0);
      expect(Number.isInteger(entry.amount)).toBe(true);
    }
  });

  it("only recognises its own bundles", () => {
    // The price comes from this list, never from the request, so a made-up id
    // is refused rather than charged for.
    expect(bundle("coins_500")?.coins).toBe(500);
    expect(bundle("coins_999999")).toBeNull();
    expect(bundle("")).toBeNull();
  });

  it("gets better value the larger it is, so nobody is punished for buying more", () => {
    const rates = COIN_BUNDLES.map((entry) => entry.amount / entry.coins);
    expect([...rates].sort((a, b) => b - a)).toEqual(rates);
  });

  it("shows a price in whole currency, never in cents", () => {
    expect(formatPrice(199, "eur")).toContain("1.99");
    expect(formatPrice(899, "eur")).toContain("8.99");
  });
});

describe("how often somebody pays for Arena Plus", () => {
  it("offers every cadence it names, and no others", () => {
    expect(Object.keys(PLUS_PLANS).sort()).toEqual([...PLUS_CADENCES].sort());
  });

  it("prices every plan in whole cents of one currency", () => {
    for (const cadence of PLUS_CADENCES) {
      const plan = PLUS_PLANS[cadence];
      expect(plan.amount).toBeGreaterThan(0);
      expect(Number.isInteger(plan.amount)).toBe(true);
      expect(plan.currency).toBe(PLUS_PLANS.monthly.currency);
    }
  });

  it("makes the year cheaper per month than the month", () => {
    // The only reason the yearly plan exists. If it ever stopped being true,
    // the page would be advertising a saving that is not one.
    expect(perMonth(PLUS_PLANS.yearly)).toBeLessThan(PLUS_PLANS.monthly.amount);
  });

  it("never claims a bigger saving than it gives", () => {
    const saving = yearlySaving();
    const monthlyYear = PLUS_PLANS.monthly.amount * 12;
    const actual = ((monthlyYear - PLUS_PLANS.yearly.amount) / monthlyYear) * 100;

    expect(saving).toBeGreaterThan(0);
    expect(saving).toBeLessThanOrEqual(actual);
  });

  it("buys exactly the same membership either way", () => {
    /*
      Section 9 is absolute that money buys cosmetics and convenience. Paying
      a year up front is a convenience to us, not a different game, so there
      is deliberately nothing in a plan that could carry an entitlement.
    */
    const shape = Object.keys(PLUS_PLANS.monthly).sort();
    expect(Object.keys(PLUS_PLANS.yearly).sort()).toEqual(shape);
    expect(shape).toEqual(
      ["amount", "cadence", "currency", "every", "interval"].sort()
    );
  });

  it("reads the interval the same way Stripe does", () => {
    // Checked against the retrieved price before checkout opens, so these
    // strings have to be Stripe's own.
    expect(PLUS_PLANS.monthly.interval).toBe("month");
    expect(PLUS_PLANS.yearly.interval).toBe("year");
  });
});
