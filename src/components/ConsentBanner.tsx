"use client";

import { useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import {
  getConsent,
  getServerConsent,
  setConsent,
  subscribeToConsent,
} from "@/lib/consent";
import { track } from "@/lib/analytics";

/*
  Asks before any optional measurement runs. Sign-in cookies are strictly
  necessary and are not covered here, which is why the wording says so rather
  than asking about them.

  Saying no is exactly as easy as saying yes, and both buttons carry the same
  weight. A banner where refusing is harder than accepting does not collect
  valid consent.
*/
export function ConsentBanner() {
  const consent = useSyncExternalStore(
    subscribeToConsent,
    getConsent,
    getServerConsent
  );

  // "unknown" is the server render, where the answer is not knowable yet.
  if (consent !== "unset") return null;

  const choose = (choice: "granted" | "denied") => {
    setConsent(choice);
    // Only meaningful for a yes. A no records nothing, which is the point.
    if (choice === "granted") track("consent_granted");
  };

  return (
    <div
      role="dialog"
      aria-label="Optional measurement"
      className="card-sheen glass fixed inset-x-4 bottom-4 z-50 mx-auto max-w-md rounded-xl p-4 ring-1 ring-foreground/20 sm:right-6 sm:left-auto"
    >
      <p className="text-sm text-muted-foreground">
        Page views and load times help us keep the app fast. Sign-in cookies
        always run. Measuring how the app is used is optional, and Arena works
        the same either way.
      </p>
      <div className="mt-3 flex gap-2">
        <Button size="sm" onClick={() => choose("granted")}>
          Allow
        </Button>
        <Button size="sm" variant="outline" onClick={() => choose("denied")}>
          No thanks
        </Button>
      </div>
    </div>
  );
}
