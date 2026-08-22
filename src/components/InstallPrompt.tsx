"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { Share, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { track } from "@/lib/analytics";
import { getConsent, getServerConsent, subscribeToConsent } from "@/lib/consent";

/*
  Installing matters more here than on most sites: iOS Safari only delivers web
  push to a site added to the home screen, so an uninstalled player can never
  be told they just got passed.

  It still does not earn an interruption on page load. The plan asks for a
  well-timed prompt, so this waits for a finished week and stays dismissed for
  30 days once waved off.
*/

const DISMISSED_KEY = "arena.install.dismissed-until";
const DISMISS_DAYS = 30;

/** Let the page settle before asking for anything. */
const SETTLE_MS = 2500;

type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS reports installed state on navigator, not through display-mode.
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isDismissed() {
  try {
    const until = window.localStorage.getItem(DISMISSED_KEY);
    return until ? Number(until) > Date.now() : false;
  } catch {
    // Private browsing can throw on storage access. Treat it as not dismissed.
    return false;
  }
}

export function InstallPrompt({ weeksPlayed }: { weeksPlayed: number }) {
  const [deferred, setDeferred] = useState<InstallEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [iosHint, setIosHint] = useState(false);

  /*
    The measurement question and this are both a small pane at the bottom of
    the window, both role="dialog", both the same width and the same distance
    up. Shown together they landed on each other: measured at 390px and at
    1280px, the notice sat inside this box and, being later in the document at
    the same z-index, painted over the install button and the dismiss cross.

    Only one can be asked at a time, and it is not this one. Answering the
    measurement question is a condition of anything optional running at all,
    while this is a suggestion -- and a suggestion that, as the note at the
    top of this file says, does not earn an interruption. So it waits.

    Nothing is lost by waiting: beforeinstallprompt has already been caught
    and held by then, so the prompt appears as soon as the question is
    answered, in the space the notice has just left.
  */
  const consent = useSyncExternalStore(
    subscribeToConsent,
    getConsent,
    getServerConsent
  );
  const asking = consent === "unset" || consent === "unknown";

  // A player who has not finished a week has not seen the good part yet.
  const earnedPrompt = weeksPlayed >= 1;

  useEffect(() => {
    if (!earnedPrompt || isStandalone() || isDismissed()) return;

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setDeferred(event as InstallEvent);
      setVisible(true);
      track("install_prompt_shown", { platform: "web" });
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);

    /*
      iOS fires no beforeinstallprompt, so Safari needs the manual steps
      spelled out instead of a button that cannot work. It waits out the same
      settle delay so the prompt never lands on top of a page still painting.
    */
    const ua = window.navigator.userAgent;
    const isIosSafari = /iPad|iPhone|iPod/.test(ua) && !/CriOS|FxiOS/.test(ua);

    const timer = isIosSafari
      ? window.setTimeout(() => {
          setIosHint(true);
          setVisible(true);
          track("install_prompt_shown", { platform: "ios" });
        }, SETTLE_MS)
      : undefined;

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      if (timer) window.clearTimeout(timer);
    };
  }, [earnedPrompt]);

  const dismiss = useCallback(() => {
    setVisible(false);
    track("install_prompt_dismissed");
    try {
      window.localStorage.setItem(
        DISMISSED_KEY,
        String(Date.now() + DISMISS_DAYS * 24 * 60 * 60 * 1000)
      );
    } catch {
      // Nothing to do. The prompt simply reappears next session.
    }
  }, []);

  const install = useCallback(async () => {
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    track(outcome === "accepted" ? "install_prompt_accepted" : "install_prompt_dismissed");
    setDeferred(null);
    setVisible(false);
  }, [deferred]);

  if (!visible || asking) return null;

  return (
    <div
      role="dialog"
      aria-label="Add Upside Arena to your home screen"
      className="bottom-notice card-sheen glass fixed inset-x-4 z-50 mx-auto max-w-md rounded-xl p-4 ring-1 ring-foreground/20 sm:inset-x-auto sm:right-6"
    >
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <p className="text-sm font-medium">Keep Arena on your home screen</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {iosHint ? (
              <>
                Tap the share button <Share className="inline size-3.5" aria-hidden="true" />{" "}
                then &ldquo;Add to home screen&rdquo;. That is the only way we can tell you
                when someone passes you.
              </>
            ) : (
              "It opens like an app, and it is how we let you know when someone passes you."
            )}
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={dismiss} aria-label="Not now">
          <X />
        </Button>
      </div>

      {!iosHint ? (
        <div className="mt-3 flex gap-2">
          <Button size="sm" onClick={install}>
            Add to home screen
          </Button>
          <Button size="sm" variant="ghost" onClick={dismiss}>
            Not now
          </Button>
        </div>
      ) : null}
    </div>
  );
}
