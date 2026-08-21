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
  Lets someone change their mind later, which the law requires to be as easy as
  giving consent in the first place.
*/
export function ConsentControl() {
  const consent = useSyncExternalStore(
    subscribeToConsent,
    getConsent,
    getServerConsent
  );

  if (consent === "unknown") return null;

  const granted = consent === "granted";

  return (
    <div className="flex flex-col items-start gap-2">
      <p className="text-sm text-muted-foreground">
        {granted
          ? "You are letting us measure page views and load times."
          : "We are not measuring how you use the app."}
      </p>
      <Button
        variant="outline"
        onClick={() => {
          // Record the withdrawal before it takes effect, otherwise the event
          // itself would be dropped by the gate it is reporting on.
          if (granted) track("consent_withdrawn");
          setConsent(granted ? "denied" : "granted");
          if (!granted) track("consent_granted");
        }}
      >
        {granted ? "Stop measuring" : "Allow measuring"}
      </Button>
    </div>
  );
}
