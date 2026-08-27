"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { manageSubscription, startSubscription } from "@/app/(app)/plus/actions";
import {
  PLUS_PLANS,
  formatPrice,
  perMonth,
  yearlySaving,
  type PlusCadence,
} from "@/lib/billing/plan";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";
import { SettingBar } from "@/components/ui/setting-row";

/*
  Subscribing, and stopping.

  Both are one button, and the stopping one is not smaller, greyer or further
  down the page than the starting one. Cancelling has to be as easy as
  signing up, and the cheapest way to mean that rather than claim it is to
  send people straight to the payment provider's own portal.
*/
export function PlusControls({
  status,
  hasPlus,
  until,
  cadences,
  canManage,
}: {
  status: "none" | "active" | "past_due" | "cancelled";
  hasPlus: boolean;
  until: string | null;
  /*
    Which cadences can actually be bought. Empty means Plus is not on sale,
    and one entry means no picker: a choice with one side missing is worse
    than no choice at all.
  */
  cadences: PlusCadence[];
  /*
    Whether there is a payment to manage at all. An entitlement can exist
    without one, and offering to cancel something nobody is being charged for
    leads to a button that can only fail.
  */
  canManage: boolean;
}) {
  const [busy, startTransition] = useTransition();
  const [cadence, setCadence] = useState<PlusCadence>(cadences[0] ?? "monthly");

  const canSubscribe = cadences.length > 0;
  const saving = yearlySaving();

  function subscribe() {
    startTransition(async () => {
      track("plus_checkout_started", { cadence });
      const result = await startSubscription(cadence);
      // A success redirects to Stripe and never returns here.
      if (!result.ok) toast.error(result.error);
    });
  }

  function manage() {
    startTransition(async () => {
      track("plus_manage_opened");
      const result = await manageSubscription();
      if (!result.ok) toast.error(result.error);
    });
  }

  if (!hasPlus && status !== "past_due") {
    const chosen = PLUS_PLANS[cadence];

    return (
      <div className="flex flex-col gap-3">
        {cadences.length > 1 ? (
          <div
            role="radiogroup"
            aria-label="How often you are charged"
            className="flex w-full flex-col gap-2 sm:flex-row"
          >
            {cadences.map((option) => {
              const plan = PLUS_PLANS[option];
              const active = option === cadence;

              return (
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setCadence(option)}
                  className={cn(
                    "flex flex-1 flex-col items-start gap-0.5 rounded-lg border px-4 py-3 text-left transition-colors",
                    active
                      ? "border-primary bg-primary/10"
                      : "border-border hover:bg-foreground/5"
                  )}
                >
                  <span className="figure text-base font-semibold">
                    {formatPrice(plan.amount, plan.currency)}{" "}
                    <span className="text-sm font-normal text-muted-foreground">
                      {plan.every}
                    </span>
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {plan.interval === "year"
                      ? /*
                          The comparison is stated as what it costs per month,
                          not as a struck-through price that was never charged.
                        */
                        `${formatPrice(perMonth(plan), plan.currency)} a month${
                          saving > 0 ? `, ${saving}% less` : ""
                        }`
                      : "Stop it whenever you like"}
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}

        <SettingBar
          action={
            <Button size="sm" disabled={busy || !canSubscribe} onClick={subscribe}>
              Take Arena Plus
            </Button>
          }
          description={
            canSubscribe
              ? "Renews until you stop it. Tax is worked out at checkout and shown before you pay."
              : undefined
          }
        >
          <span className="block truncate text-sm font-medium">
            {canSubscribe
              ? `${formatPrice(chosen.amount, chosen.currency)} ${chosen.every}`
              : "Not on sale yet"}
          </span>
        </SettingBar>
      </div>
    );
  }

  const statusCopy =
    status === "past_due" ? (
      <>
        <span className="text-loss">Your last payment did not go through.</span>{" "}
        <span className="text-muted-foreground">
          Nothing has been taken away. Update your card and it carries on.
        </span>
      </>
    ) : status === "cancelled" ? (
      `Cancelled. You keep everything until ${until ?? "it runs out"}, because you have paid for it.`
    ) : (
      `Renews ${until ? `on ${until}` : "each period"}. Stop it whenever you like.`
    );

  return (
    <SettingBar
      action={
        canManage ? (
          <Button variant="outline" size="sm" disabled={busy} onClick={manage}>
            {status === "past_due" ? "Update your card" : "Manage or cancel"}
          </Button>
        ) : undefined
      }
      description={
        canManage ? (
          <p className="text-sm text-muted-foreground">{statusCopy}</p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Nobody is charging you for this, so there is nothing to cancel.
          </p>
        )
      }
    >
      <span className="block truncate text-sm font-medium">Membership</span>
    </SettingBar>
  );
}
