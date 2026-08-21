"use client";

/*
  Product analytics is threaded through every phase rather than bolted on at
  the end. This is the single call site the app uses, so swapping in PostHog
  or Amplitude later is a change here and nowhere else.

  Events are dropped silently when no key is configured, which keeps local
  development and tests free of network calls.
*/

export type AnalyticsEvent =
  | "signin_viewed"
  | "age_gate_blocked"
  | "signin_link_requested"
  | "signin_google_started"
  | "signin_completed"
  | "onboarding_viewed"
  | "onboarding_completed"
  | "profile_updated"
  | "install_prompt_shown"
  | "install_prompt_accepted"
  | "install_prompt_dismissed"
  | "account_data_exported"
  | "account_deleted"
  | "signed_out";

const enabled = Boolean(process.env.NEXT_PUBLIC_ANALYTICS_KEY);

export function track(event: AnalyticsEvent, properties?: Record<string, unknown>) {
  if (!enabled) {
    if (process.env.NODE_ENV === "development") {
      console.debug("[analytics]", event, properties ?? {});
    }
    return;
  }

  // Replace with the vendor client when one is chosen. Kept as a queue so no
  // event is lost between now and then.
  window.__arenaAnalyticsQueue ??= [];
  window.__arenaAnalyticsQueue.push({ event, properties, at: Date.now() });
}

declare global {
  interface Window {
    __arenaAnalyticsQueue?: Array<{
      event: AnalyticsEvent;
      properties?: Record<string, unknown>;
      at: number;
    }>;
  }
}
