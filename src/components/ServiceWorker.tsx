"use client";

import { useEffect } from "react";

/*
  Registers the service worker, which makes Arena installable and is what
  receives push. Installability is not a nicety: iOS Safari only delivers web
  push to a site added to the home screen, so a plain browser tab gets no
  notifications at all.

  Not the only place it is registered. Turning notifications on registers it
  too, because that is a moment where waiting for a worker that never arrived
  would look like a broken switch.
*/
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // An unavailable service worker degrades the install prompt only.
        // Nothing in the app depends on it.
      });
    };

    /*
      Not on the first paint. `load` still races the webfont and hydration
      on a slow phone, which is the landing's long task. Idle with a 2.5s
      ceiling waits for a quiet moment without leaving installability
      hanging; turning notifications on registers the worker itself.
    */
    const schedule = () => {
      if (typeof window.requestIdleCallback === "function") {
        window.requestIdleCallback(register, { timeout: 2500 });
      } else {
        register();
      }
    };

    if (document.readyState === "complete") schedule();
    else window.addEventListener("load", schedule, { once: true });
  }, []);

  return null;
}
