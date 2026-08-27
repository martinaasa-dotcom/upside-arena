"use client";

import { useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { SettingBar } from "@/components/ui/setting-row";
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
    <SettingBar
      action={
        <Button
          variant="outline"
          size="sm"
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
      }
      description={
        granted
          ? "You are letting us measure page views and load times."
          : "We are not measuring how you use the app."
      }
    >
      <span className="block truncate text-sm font-medium">
        {granted ? "On" : "Off"}
      </span>
    </SettingBar>
  );
}
