"use client";

import { useSyncExternalStore } from "react";
import { Analytics as VercelAnalytics } from "@vercel/analytics/next";
import {
  getConsent,
  getServerConsent,
  subscribeToConsent,
} from "@/lib/consent";

/*
  Page views and load times, the same measurement Upside Lab uses.

  It loads only once someone has said yes. Mounting it and hoping the vendor
  respects a flag is not consent, so the script is simply absent until then,
  and unmounts again the moment consent is withdrawn.
*/
export function Analytics() {
  const consent = useSyncExternalStore(
    subscribeToConsent,
    getConsent,
    getServerConsent
  );

  if (consent !== "granted") return null;

  return <VercelAnalytics />;
}
