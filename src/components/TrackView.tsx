"use client";

import { useEffect } from "react";
import { track, type AnalyticsEvent, type EventProperties } from "@/lib/analytics";

/*
  Records that a screen was opened, from a server-rendered page.

  A page view is a client fact, so a server component cannot report one
  itself. This is the smallest possible client boundary for saying so: it
  renders nothing and holds no state.

  Fires once per mount rather than once per render, which is what makes it a
  count of screens opened rather than of React deciding to run again.
*/
export function TrackView({
  event,
  properties,
}: {
  event: AnalyticsEvent;
  properties?: EventProperties;
}) {
  const serialised = properties ? JSON.stringify(properties) : "";

  useEffect(() => {
    track(event, serialised ? (JSON.parse(serialised) as EventProperties) : undefined);
  }, [event, serialised]);

  return null;
}
