import "server-only";

import { canWriteGame } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { pushConfigured, emailConfigured } from "@/lib/notify/send";
import type { NotificationSettingsRow } from "@/lib/supabase/database.types";

/*
  Reading and changing what somebody has agreed to be interrupted for.

  Every write goes through a security definer function, the same as every other
  write in the app: a player can read their own settings and cannot write them
  directly, so there is exactly one path in and it is the one that validates.
*/

export type NotificationSettings = {
  push: boolean;
  email: boolean;
  rivalAlerts: boolean;
  weekResult: boolean;
  streakReminder: boolean;
  leagueActivity: boolean;
  timezone: string;
};

export const DEFAULT_SETTINGS: NotificationSettings = {
  push: true,
  email: true,
  rivalAlerts: true,
  weekResult: true,
  streakReminder: true,
  leagueActivity: true,
  timezone: "America/New_York",
};

function fromRow(row: NotificationSettingsRow): NotificationSettings {
  return {
    push: row.push_enabled,
    email: row.email_enabled,
    rivalAlerts: row.rival_alerts,
    weekResult: row.week_result,
    streakReminder: row.streak_reminder,
    leagueActivity: row.league_activity,
    timezone: row.timezone,
  };
}

export async function getNotificationSettings(
  userId: string
): Promise<NotificationSettings> {
  if (!canWriteGame) return DEFAULT_SETTINGS;

  const admin = createAdminClient();
  const { data } = await admin
    .from("notification_settings")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  return data ? fromRow(data as NotificationSettingsRow) : DEFAULT_SETTINGS;
}

/**
 * Saves what somebody wants to be sent, and returns null if it did not save.
 *
 * Null rather than the defaults, which is what this used to hand back when
 * the write failed. The defaults have push and email switched on, so the one
 * call that matters — somebody turning a channel off — answered a failure
 * with a value saying the channel was on, and every caller took it for the
 * saved state. A preference that did not save has to be distinguishable from
 * one that did, because this is the row delivery is gated on.
 */
export async function saveNotificationSettings(
  userId: string,
  next: Partial<NotificationSettings>
): Promise<NotificationSettings | null> {
  if (!canWriteGame) return null;

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("save_notification_settings", {
    p_user_id: userId,
    p_push_enabled: next.push ?? null,
    p_email_enabled: next.email ?? null,
    p_rival_alerts: next.rivalAlerts ?? null,
    p_week_result: next.weekResult ?? null,
    p_streak_reminder: next.streakReminder ?? null,
    p_league_activity: next.leagueActivity ?? null,
    p_timezone: next.timezone ?? null,
  });

  if (error || !data) {
    console.error("notification settings not saved", error);
    return null;
  }

  return fromRow(data as NotificationSettingsRow);
}

/** How many browsers this player currently has listening. */
export async function countPushSubscriptions(userId: string): Promise<number> {
  if (!canWriteGame || !pushConfigured) return 0;

  const admin = createAdminClient();
  const { count } = await admin
    .from("push_subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  return count ?? 0;
}

export async function savePushSubscription(
  userId: string,
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  userAgent: string | null
): Promise<boolean> {
  if (!canWriteGame || !pushConfigured) return false;

  const admin = createAdminClient();
  const { error } = await admin.rpc("save_push_subscription", {
    p_user_id: userId,
    p_endpoint: subscription.endpoint,
    p_p256dh: subscription.keys.p256dh,
    p_auth: subscription.keys.auth,
    p_user_agent: userAgent,
  });

  return !error;
}

export async function removePushSubscription(endpoint: string): Promise<boolean> {
  if (!canWriteGame) return false;
  const admin = createAdminClient();
  const { error } = await admin.rpc("delete_push_subscription", {
    p_endpoint: endpoint,
  });
  return !error;
}

/** What the profile page needs to describe the state of things honestly. */
export async function getNotificationState(userId: string) {
  const [settings, devices] = await Promise.all([
    getNotificationSettings(userId),
    countPushSubscriptions(userId),
  ]);

  return {
    settings,
    devices,
    pushAvailable: pushConfigured,
    emailAvailable: emailConfigured,
  };
}
