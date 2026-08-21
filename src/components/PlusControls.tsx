"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { manageSubscription, startSubscription } from "@/app/(app)/plus/actions";
import { track } from "@/lib/analytics";

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
  canSubscribe,
  canManage,
}: {
  status: "none" | "active" | "past_due" | "cancelled";
  hasPlus: boolean;
  until: string | null;
  canSubscribe: boolean;
  /*
    Whether there is a payment to manage at all. An entitlement can exist
    without one, and offering to cancel something nobody is being charged for
    leads to a button that can only fail.
  */
  canManage: boolean;
}) {
  const [busy, startTransition] = useTransition();

  function subscribe() {
    startTransition(async () => {
      track("plus_checkout_started");
      const result = await startSubscription();
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
    return (
      <div className="flex flex-col items-start gap-2">
        <Button disabled={busy || !canSubscribe} onClick={subscribe}>
          Take Arena Plus
        </Button>
        <p className="text-sm text-muted-foreground">
          {canSubscribe
            ? "You will see the price and how often you are charged before you pay anything."
            : "Not on sale yet."}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <p className="text-sm">
        {status === "past_due" ? (
          <>
            <span className="text-loss">Your last payment did not go through.</span>{" "}
            <span className="text-muted-foreground">
              Nothing has been taken away. Update your card and it carries on.
            </span>
          </>
        ) : status === "cancelled" ? (
          <span className="text-muted-foreground">
            Cancelled. You keep everything until {until ?? "it runs out"}, because
            you have paid for it.
          </span>
        ) : (
          <span className="text-muted-foreground">
            Renews {until ? `on ${until}` : "each period"}. Stop it whenever you
            like.
          </span>
        )}
      </p>

      {canManage ? (
        <Button variant="outline" disabled={busy} onClick={manage}>
          {status === "past_due" ? "Update your card" : "Manage or cancel"}
        </Button>
      ) : (
        <p className="text-sm text-muted-foreground">
          Nobody is charging you for this, so there is nothing to cancel.
        </p>
      )}
    </div>
  );
}
