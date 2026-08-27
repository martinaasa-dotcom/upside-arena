"use client";

import { useEffect, useId, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Well } from "@/components/Panel";
import { SettingBar } from "@/components/ui/setting-row";
import { track } from "@/lib/analytics";
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
import { DAILY_CAP, QUIET_HOURS } from "@/lib/notify/timing";
import { KINDS } from "@/lib/notify/kinds";
import type { NotificationSettings as Settings } from "@/lib/notify/settings";

/*
  What Arena is allowed to interrupt you for.

  Each kind is separately refusable and every switch takes effect the moment it
  is moved, with no save button to forget. The kinds are named for what they
  are rather than by channel, because "someone passed you" is a thing a
  person has an opinion about and "push notifications" is not.
*/


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
  const ids = useId();

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
        track("push_blocked", { from: "settings" });
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
      track("push_enabled", { from: "settings" });
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
      const done = await unsubscribeFromPush(endpoint);

      /*
        Checked, where turning them on already was. Off is the direction worth
        checking hardest: somebody told a channel is closed while it is still
        open does not come back and ask again, and the screen would have gone
        on saying off while the next notification arrived.
      */
      if (!done.ok) {
        toast.error("We could not turn those off. Try again.");
        return;
      }

      setSubscribed(false);
      track("push_disabled");
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
        <Well className="py-3">
          <SettingBar
            action={
              device.blocked ? null : (
                <Button
                  variant={pushOn ? "outline" : "default"}
                  size="sm"
                  disabled={busy || (denied && !pushOn)}
                  onClick={pushOn ? turnPushOff : turnPushOn}
                >
                  {pushOn ? "Turn off" : "Turn on"}
                </Button>
              )
            }
            description={
              device.blocked
                ? device.blocked
                : pushOn
                  ? "Arena can send notifications to this browser."
                  : denied
                    ? "Your browser is blocking notifications. Allow them in its site settings first."
                    : "Off. Nothing is sent to this browser."
            }
          >
            <span className="block truncate text-sm font-medium">On this device</span>
          </SettingBar>
        </Well>
      ) : null}

      {emailAvailable ? (
        <SettingBar
          action={
            <Switch
              id={`${ids}-email`}
              checked={settings.email}
              disabled={busy}
              onCheckedChange={(value) => save({ email: value })}
            />
          }
          description="Used only when no browser of yours is listening, so you never get both."
        >
          <label
            htmlFor={`${ids}-email`}
            className="block cursor-pointer truncate text-sm font-medium"
          >
            Email instead
          </label>
        </SettingBar>
      ) : null}

      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">What we tell you about</p>
        {KINDS.map((kind) => (
          <SettingBar
            key={kind.key}
            action={
              <Switch
                id={`${ids}-${kind.key}`}
                checked={settings[kind.key]}
                disabled={busy}
                onCheckedChange={(value) => {
                  // Which kind people actually turn off is the whole argument
                  // for having made each of them separately refusable.
                  track("notification_kind_toggled", { kind: kind.key, on: value });
                  save({ [kind.key]: value });
                }}
              />
            }
            description={kind.detail}
          >
            <label
              htmlFor={`${ids}-${kind.key}`}
              className="block cursor-pointer truncate text-sm font-medium"
            >
              {kind.label}
            </label>
          </SettingBar>
        ))}
      </div>

      {/*
        The two numbers come from the module that enforces them rather than
        from this sentence. They were written out here in words, which meant
        the promise and the rule were two separate things that happened to
        agree, and only one of them was tested.
      */}
      <p className="text-sm text-muted-foreground">
        Never more than {DAILY_CAP} a day, and never between {QUIET_HOURS} where
        you are. We do not send anything about a losing week.
      </p>
    </div>
  );
}
