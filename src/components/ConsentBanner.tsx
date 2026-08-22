"use client";

import { useEffect, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  getConsent,
  getServerConsent,
  setConsent,
  subscribeToConsent,
} from "@/lib/consent";
import { track } from "@/lib/analytics";
import { hasDock } from "@/lib/rooms";

/*
  Asks before any optional measurement runs. Sign-in cookies are strictly
  necessary and are not covered here, which is why the wording says so rather
  than asking about them.

  Saying no is exactly as easy as saying yes, and both buttons carry the same
  weight. A banner where refusing is harder than accepting does not collect
  valid consent.
*/
export function ConsentBanner() {
  const pathname = usePathname();
  // Which routes carry the dock is read from the rooms themselves, so adding
  // a room cannot leave this notice sitting on top of it.
  const overDock = hasDock(pathname);

  const consent = useSyncExternalStore(
    subscribeToConsent,
    getConsent,
    getServerConsent
  );

  const asking = consent === "unset";

  /*
    Tell the page it is being asked something, so the frame can leave room at
    the bottom for this. Without it the notice sits on top of whatever the
    page ends with: on a wide screen that is empty space, but on a phone the
    column is narrower and the last card runs underneath, with figures
    legible through the glass.
  */
  useEffect(() => {
    if (!asking) return;
    const root = document.documentElement;
    root.setAttribute("data-consent-asking", "");
    return () => root.removeAttribute("data-consent-asking");
  }, [asking]);

  // "unknown" is the server render, where the answer is not knowable yet.
  if (!asking) return null;

  const choose = (choice: "granted" | "denied") => {
    setConsent(choice);
    // Only meaningful for a yes. A no records nothing, which is the point.
    if (choice === "granted") track("consent_granted");
  };

  return (
    <div
      role="dialog"
      aria-label="Optional measurement"
      /*
        Lifted above the bottom dock on the rooms that have one, and left at
        the bottom edge where there is none. Fixed at bottom-28 everywhere it
        sat on top of the sign-in button on a phone, which is a cookie notice
        covering the one thing a new visitor came to do.
      */
      className={cn(
        "card-sheen glass-notice fixed inset-x-4 z-50 mx-auto max-w-md rounded-xl p-4 ring-1 ring-foreground/20 sm:right-6 sm:left-auto",
        // The dock is centred and wide, so on a desktop it reaches the
        // right-hand edge where this sits. Clearing it needs the lift at
        // every width, not just on a phone.
        overDock ? "bottom-28 sm:bottom-28" : "bottom-4 sm:bottom-6"
      )}
    >
      <p className="text-sm text-muted-foreground">
        Measuring page views and load times is optional. Sign-in cookies
        always run.
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
