"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import {
  removePushSubscription,
  savePushSubscription,
  saveNotificationSettings,
  type NotificationSettings,
} from "@/lib/notify/settings";

/*
  The player's own changes to what reaches them.

  Turning something off is one call and takes effect immediately: there is no
  confirmation step, no "are you sure", and nothing that keeps sending while a
  preference is pending. A channel somebody cannot leave is a channel they
  report as spam.
*/

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/** A timezone is only trusted if the browser's own Intl agrees it is real. */
function validTimezone(value: string | null): string | null {
  if (!value) return null;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return value;
  } catch {
    return null;
  }
}

export async function submitNotificationSettings(
  next: Partial<NotificationSettings>
): Promise<{ ok: boolean }> {
  const user = await requireUser();
  if (!user) return { ok: false };

  const saved = await saveNotificationSettings(user.id, {
    ...next,
    timezone: validTimezone(next.timezone ?? null) ?? undefined,
  });

  revalidatePath("/profile");
  return { ok: saved != null };
}

export async function subscribeToPush(subscription: {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  timezone?: string;
}): Promise<{ ok: boolean }> {
  const user = await requireUser();
  if (!user) return { ok: false };

  if (!subscription.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
    return { ok: false };
  }

  const userAgent = (await headers()).get("user-agent");
  const saved = await savePushSubscription(user.id, subscription, userAgent);
  if (!saved) return { ok: false };

  /*
    Agreeing at the browser prompt is the agreement. Turning the preference on
    here as well means the two can never disagree, which is what produces the
    "I said yes and nothing arrives" complaint.
  */
  const settings = await saveNotificationSettings(user.id, {
    push: true,
    timezone: validTimezone(subscription.timezone ?? null) ?? undefined,
  });

  revalidatePath("/profile");
  return { ok: settings != null };
}

export async function unsubscribeFromPush(endpoint: string): Promise<{ ok: boolean }> {
  const user = await requireUser();
  if (!user) return { ok: false };

  if (endpoint) await removePushSubscription(endpoint);

  /*
    This is the one that decides it. Delivery is gated on the preference row,
    not on whether a device is still registered, so the answer to "are they
    off" is whether this saved — and it used to be reported as yes whatever
    happened. Somebody who asks to stop being messaged, is told it worked, and
    keeps being messaged does not ask again; they report it as spam, which is
    what the note at the top of this file is about.

    A device left registered with the preference off receives nothing, and the
    next send that reaches a dead endpoint clears the row on a 410.
  */
  const saved = await saveNotificationSettings(user.id, { push: false });

  revalidatePath("/profile");
  return { ok: saved != null };
}
