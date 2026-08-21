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

  await saveNotificationSettings(user.id, {
    ...next,
    timezone: validTimezone(next.timezone ?? null) ?? undefined,
  });

  revalidatePath("/profile");
  return { ok: true };
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
  await saveNotificationSettings(user.id, {
    push: true,
    timezone: validTimezone(subscription.timezone ?? null) ?? undefined,
  });

  revalidatePath("/profile");
  return { ok: true };
}

export async function unsubscribeFromPush(endpoint: string): Promise<{ ok: boolean }> {
  const user = await requireUser();
  if (!user) return { ok: false };

  if (endpoint) await removePushSubscription(endpoint);
  await saveNotificationSettings(user.id, { push: false });

  revalidatePath("/profile");
  return { ok: true };
}
