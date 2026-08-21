"use client";

/*
  Consent for optional measurement.

  Sign-in cookies are strictly necessary and are not covered here. Everything
  else waits for a yes. Nothing is recorded until getConsent() returns
  "granted", which is what makes the privacy policy's claim true rather than
  aspirational.
*/

const KEY = "arena.consent.measurement";
const CHANGED = "arena:consent-changed";

export type Consent =
  | "granted"
  | "denied"
  /** Asked for, not answered yet. */
  | "unset"
  /** Rendered on the server, where the answer cannot be known. */
  | "unknown";

export function getConsent(): Consent {
  if (typeof window === "undefined") return "unknown";
  try {
    const stored = window.localStorage.getItem(KEY);
    return stored === "granted" || stored === "denied" ? stored : "unset";
  } catch {
    // Private browsing can throw on storage access. Treat that as no consent,
    // which is the safe direction.
    return "unset";
  }
}

/** Server render cannot see storage, and must not guess. */
export function getServerConsent(): Consent {
  return "unknown";
}

export function setConsent(consent: "granted" | "denied") {
  try {
    window.localStorage.setItem(KEY, consent);
  } catch {
    // If it cannot be stored, the choice lasts for this page only and we ask
    // again next time. Asking twice is better than assuming a yes.
  }
  window.dispatchEvent(new CustomEvent(CHANGED));
}

/**
 * Subscription for useSyncExternalStore, so every reader of the choice stays
 * in step with every writer of it.
 */
export function subscribeToConsent(onChange: () => void) {
  window.addEventListener(CHANGED, onChange);
  // Another tab changing the choice has to be honoured here too.
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGED, onChange);
    window.removeEventListener("storage", onChange);
  };
}
