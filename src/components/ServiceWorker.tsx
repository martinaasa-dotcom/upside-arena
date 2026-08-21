"use client";

import { useEffect } from "react";

/*
  Registers the service worker that makes Arena installable. Installability is
  a day-one requirement: iOS Safari only delivers web push to a site added to
  the home screen, so a plain browser tab gets no notifications at all.
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

    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);

  return null;
}
