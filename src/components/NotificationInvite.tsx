"use client";

import { useEffect, useState, useTransition } from "react";
import { BellRing, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Well } from "@/components/Panel";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";
import { SETTING_COPY, SETTING_ROW } from "@/components/ui/setting-row";
import {
  browserTimezone,
  currentEndpoint,
  permissionState,
  pushUnavailableReason,
  subscribe,
} from "@/lib/notify/browser";
import { subscribeToPush } from "@/app/(app)/profile/notification-actions";

/*
  Asking to be allowed to send notifications.

  Never on first load. A browser gives a site exactly one permission prompt
  that matters: refuse it and the answer is remembered for good, with no way
  for the site to ask again. So this waits until there is something concrete
  to be notified about, says what that thing is, and only then puts the prompt
  in front of anyone.

  Dismissing it is remembered in this browser, and the switch on the profile
  page is always there for somebody who changes their mind.
*/

const DISMISSED = "arena.notify.invited";

export function NotificationInvite({
  reason,
  kind,
  publicKey,
}: {
  /** The concrete thing they would be told about. Empty means do not ask. */
  reason: string;
  /*
    Which sort of reason it was, for measurement. Separate from the sentence
    itself because that sentence carries a league name, and a league name is
    something a player typed about people they know. It does not go to a
    measurement vendor.
  */
  kind: "rival" | "streak";
  publicKey: string;
}) {
  const [visible, setVisible] = useState(false);
  const [busy, startTransition] = useTransition();

  useEffect(() => {
    if (!reason || !publicKey) return;
    if (pushUnavailableReason()) return;

    // Already answered, either way. Asking again is not possible and would be
    // rude if it were.
    if (permissionState() !== "default") return;

    try {
      if (window.localStorage.getItem(DISMISSED)) return;
    } catch {
      // A browser refusing storage is not a reason to nag; it is a reason to
      // ask once this session and no more.
    }

    void currentEndpoint().then((endpoint) => {
      if (endpoint) return;
      setVisible(true);
      // Which reason was offered, so it is visible whether asking after a
      // rival appears works better than asking after a streak starts.
      track("notification_invite_shown", { kind });
    });
  }, [reason, kind, publicKey]);

  function remember() {
    try {
      window.localStorage.setItem(DISMISSED, "1");
    } catch {
      // Nothing to do. It will be offered again, which is the gentler failure.
    }
  }

  function dismiss() {
    remember();
    setVisible(false);
    track("notification_invite_dismissed");
  }

  function accept() {
    startTransition(async () => {
      const outcome = await subscribe(publicKey);
      remember();

      if (outcome.state === "subscribed" && outcome.subscription) {
        const saved = await subscribeToPush({
          ...outcome.subscription,
          timezone: browserTimezone(),
        });

        setVisible(false);

        /*
          Agreeing at the browser prompt is not the same as it having been
          written down. Promising to tell somebody about their week and then
          never doing it, because the preference never saved, is the "I said
          yes and nothing arrives" complaint the settings screen is careful to
          avoid; this said it whether or not the write went through.
        */
        if (!saved.ok) {
          toast.error("We could not turn those on. Try again from your profile.");
          return;
        }

        track("notification_invite_accepted");
        track("push_enabled", { from: "invite" });
        toast.success("We will only tell you when something actually happens.");
        return;
      }

      setVisible(false);
      if (outcome.state === "denied") {
        // A refusal is permanent in the browser, so this is the number that
        // says whether the moment we chose to ask was the right one.
        track("push_blocked", { from: "invite" });
        toast("Left off. You can turn them on any time from your profile.");
      }
    });
  }

  if (!visible) return null;

  return (
    <Well className={cn(SETTING_ROW, "items-start py-3")}>
      <BellRing className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
      <div className={SETTING_COPY}>
        <p className="text-sm">{reason}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          At most three a day, nothing at night, and nothing at all about a bad
          week. Off again in one tap.
        </p>
        <div className="mt-3 flex items-center gap-2">
          <Button size="sm" disabled={busy} onClick={accept}>
            Tell me
          </Button>
          <Button size="sm" variant="ghost" disabled={busy} onClick={dismiss}>
            No thanks
          </Button>
        </div>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="-m-1 shrink-0 rounded p-1 text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <X className="size-4" aria-hidden="true" />
      </button>
    </Well>
  );
}
