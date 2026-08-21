"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Well } from "@/components/Panel";
import {
  browserTimezone,
  currentEndpoint,
  permissionState,
  pushUnavailableReason,
  subscribe,
  unsubscribe,
} from "@/lib/notify/browser";
import {
  submitNotificationSettings,
  subscribeToPush,
  unsubscribeFromPush,
} from "@/app/(app)/profile/notification-actions";
import type { NotificationSettings as Settings } from "@/lib/notify/settings";

/*
  What Arena is allowed to interrupt you for.

  Each kind is separately refusable and every switch takes effect the moment it
  is moved, with no save button to forget. The three kinds are named for what
  they are rather than by channel, because "someone passed you" is a thing a
  person has an opinion about and "push notifications" is not.
*/

const KINDS = [
  {
    key: "rivalAlerts" as const,
    label: "When somebody passes you",
    detail: "Only while the market is open, and only in a league you are in.",
  },
  {
    key: "weekResult" as const,
    label: "When your week is scored",
    detail: "Once, on Friday evening, whatever the result was.",
  },
  {
    key: "streakReminder" as const,
    label: "When your streak needs today",
    detail: "Late afternoon, and only if you already have a streak going.",
  },
];

export function NotificationSettings({
  initial,
  devices,
  pushAvailable,
  emailAvailable,
  publicKey,
}: {
  initial: Settings;
  devices: number;
  pushAvailable: boolean;
  emailAvailable: boolean;
  publicKey: string;
}) {
  const [settings, setSettings] = useState(initial);
  const [subscribed, setSubscribed] = useState(devices > 0);
  const [busy, startTransition] = useTransition();

  /*
    What this particular browser can do is only knowable in the browser, so it
    starts unknown and is filled in after mount. Until then the panel says
    nothing about this device rather than guessing, because guessing produces
    a control that flips under the reader's finger.
  */
  const [device, setDevice] = useState<{
    blocked: string | null;
    permission: NotificationPermission | "unsupported";
    hasEndpoint: boolean;
  } | null>(null);

  useEffect(() => {
    let live = true;

    /*
      What the browser can say straight away comes first, so the control
      appears immediately. Whether a subscription already exists takes a round
      trip through the service worker, and that answer is folded in when it
      arrives rather than held for.
    */
    void Promise.resolve().then(() => {
      if (!live) return;
      setDevice({
        blocked: pushUnavailableReason(),
        permission: permissionState(),
        hasEndpoint: false,
      });
    });

    void currentEndpoint().then((endpoint) => {
      if (!live || !endpoint) return;
      setDevice((current) => (current ? { ...current, hasEndpoint: true } : current));
      setSubscribed(true);
    });

    return () => {
      live = false;
    };
  }, []);

  function save(next: Partial<Settings>) {
    const previous = settings;
    setSettings({ ...settings, ...next });

    startTransition(async () => {
      const result = await submitNotificationSettings(next);
      if (!result.ok) {
        // Put the switch back rather than leave it showing something untrue.
        setSettings(previous);
        toast.error("We could not save that. Try again.");
      }
    });
  }

  function turnPushOn() {
    startTransition(async () => {
      const outcome = await subscribe(publicKey);

      if (outcome.state === "denied") {
        toast.error(
          "Your browser is blocking notifications. You can undo that in its site settings."
        );
        return;
      }
      if (outcome.state === "unsupported") {
        setDevice((current) =>
          current ? { ...current, blocked: outcome.reason } : current
        );
        return;
      }
      if (outcome.state !== "subscribed" || !outcome.subscription) {
        toast.error("We could not turn those on. Try again.");
        return;
      }

      const saved = await subscribeToPush({
        ...outcome.subscription,
        timezone: browserTimezone(),
      });

      if (!saved.ok) {
        toast.error("We could not turn those on. Try again.");
        return;
      }

      setSubscribed(true);
      setDevice((current) =>
        current ? { ...current, permission: "granted", hasEndpoint: true } : current
      );
      setSettings((current) => ({ ...current, push: true }));
      toast.success("Notifications are on for this device.");
    });
  }

  function turnPushOff() {
    startTransition(async () => {
      const endpoint = (await unsubscribe()) ?? "";
      await unsubscribeFromPush(endpoint);
      setSubscribed(false);
      setDevice((current) => (current ? { ...current, hasEndpoint: false } : current));
      setSettings((current) => ({ ...current, push: false }));
      toast.success("Notifications are off.");
    });
  }

  const pushOn = subscribed && settings.push;
  const denied = device?.permission === "denied";

  return (
    <div className="flex flex-col gap-5">
      {pushAvailable && device ? (
        <Well className="flex flex-wrap items-center justify-between gap-3 py-3">
          <div className="min-w-0">
            <p className="text-sm font-medium">On this device</p>
            <p className="text-sm text-muted-foreground">
              {device.blocked
                ? device.blocked
                : pushOn
                  ? "Arena can send notifications to this browser."
                  : denied
                    ? "Your browser is blocking notifications. Allow them in its site settings first."
                    : "Off. Nothing is sent to this browser."}
            </p>
          </div>
          {device.blocked ? null : (
            <Button
              variant={pushOn ? "outline" : "default"}
              size="sm"
              disabled={busy || (denied && !pushOn)}
              onClick={pushOn ? turnPushOff : turnPushOn}
            >
              {pushOn ? "Turn off" : "Turn on"}
            </Button>
          )}
        </Well>
      ) : null}

      {emailAvailable ? (
        <label className="flex items-start justify-between gap-4">
          <span className="flex min-w-0 flex-col">
            <span className="text-sm font-medium">Email instead</span>
            <span className="text-sm text-muted-foreground">
              Used only when no browser of yours is listening, so you never get both.
            </span>
          </span>
          <Switch
            checked={settings.email}
            disabled={busy}
            onCheckedChange={(value) => save({ email: value })}
            aria-label="Email instead"
          />
        </label>
      ) : null}

      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">What we tell you about</p>
        {KINDS.map((kind) => (
          <label key={kind.key} className="flex items-start justify-between gap-4">
            <span className="flex min-w-0 flex-col">
              <span className="text-sm font-medium">{kind.label}</span>
              <span className="text-sm text-muted-foreground">{kind.detail}</span>
            </span>
            <Switch
              checked={settings[kind.key]}
              disabled={busy}
              onCheckedChange={(value) => save({ [kind.key]: value })}
              aria-label={kind.label}
            />
          </label>
        ))}
      </div>

      <p className="text-sm text-muted-foreground">
        Never more than three a day, and never between nine at night and eight in
        the morning where you are. We do not send anything about a losing week.
      </p>
    </div>
  );
}
