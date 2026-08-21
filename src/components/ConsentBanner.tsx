"use client";

import { useSyncExternalStore } from "react";
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

/*
  Asks before any optional measurement runs. Sign-in cookies are strictly
  necessary and are not covered here, which is why the wording says so rather
  than asking about them.

  Saying no is exactly as easy as saying yes, and both buttons carry the same
  weight. A banner where refusing is harder than accepting does not collect
  valid consent.
*/
/* Rooms that carry the bottom dock. The notice has to sit above it there. */
const DOCK_ROUTES = ["/home", "/trade", "/leagues", "/profile"];

export function ConsentBanner() {
  const pathname = usePathname();
  const overDock = DOCK_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

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
      /*
        Lifted above the bottom dock on the rooms that have one, and left at
        the bottom edge where there is none. Fixed at bottom-28 everywhere it
        sat on top of the sign-in button on a phone, which is a cookie notice
        covering the one thing a new visitor came to do.
      */
      className={cn(
        "card-sheen glass fixed inset-x-4 z-50 mx-auto max-w-md rounded-xl p-4 ring-1 ring-foreground/20 sm:right-6 sm:bottom-6 sm:left-auto",
        overDock ? "bottom-28" : "bottom-4"
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
