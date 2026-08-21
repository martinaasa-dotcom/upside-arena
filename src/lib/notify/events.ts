import "server-only";

import { canWriteGame } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { getLeagueStandings } from "@/lib/game/leagues";
import { isTradingDay, isTradingOpen, nyDate } from "@/lib/market/session";
import { formatGap } from "@/lib/format";
import { emailConfigured, pushConfigured, sendEmail, sendPush } from "@/lib/notify/send";
import { isAwakeHour, isStreakReminderHour } from "@/lib/notify/timing";

/*
  Deciding what is worth interrupting someone for.

  Every kind here describes something that actually happened, to them, with a
  name attached. There is no "come back", no "your friends are playing without
  you", and no countdown to a deadline that was invented to create one. The
  plan is blunt about why: a nudge tied to a real change gets acted on, and a
  vague one gets the whole channel muted.

  Three things also deliberately absent:

  - Nothing is sent about a bad week. Messaging a loss as something one more
    trade could fix is the mechanic behind chasing losses, and this audience
    skews toward people who may carry that into real trading.
  - Nothing is sent outside the hours the player is likely awake.
  - Nothing is sent more than three times a day, enforced in the database
    rather than here, so a bug in this file cannot spam anyone.
*/

const DAILY_CAP = 3;

type Settings = {
  user_id: string;
  push_enabled: boolean;
  email_enabled: boolean;
  rival_alerts: boolean;
  week_result: boolean;
  streak_reminder: boolean;
  timezone: string;
};

export type NotifyResult = {
  considered: number;
  sent: number;
  skipped: Record<string, number>;
};

async function settingsFor(userIds: string[]): Promise<Map<string, Settings>> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("notification_settings")
    .select("*")
    .in("user_id", userIds);

  const map = new Map<string, Settings>();
  for (const row of (data ?? []) as Settings[]) map.set(row.user_id, row);
  return map;
}

/**
 * Who actually has a browser listening.
 *
 * Worth knowing before anything is claimed. A notification recorded as having
 * gone out by push when nobody was subscribed still counts against the daily
 * cap, which would silently spend somebody's three on messages that reached
 * nowhere.
 */
async function devicesFor(userIds: string[]): Promise<Set<string>> {
  if (!pushConfigured) return new Set();

  const admin = createAdminClient();
  const { data } = await admin
    .from("push_subscriptions")
    .select("user_id")
    .in("user_id", userIds);

  return new Set(((data ?? []) as { user_id: string }[]).map((row) => row.user_id));
}

async function emailsFor(userIds: string[]): Promise<Map<string, string>> {
  const admin = createAdminClient();
  const map = new Map<string, string>();

  // No bulk lookup exists for auth users, so this is one call each. The
  // number of people being notified in a pass is small by construction.
  await Promise.all(
    userIds.map(async (id) => {
      const { data } = await admin.auth.admin.getUserById(id);
      if (data?.user?.email) map.set(id, data.user.email);
    })
  );

  return map;
}

/**
 * Claims and delivers one notification.
 *
 * The database decides whether it is allowed: already sent, or over the daily
 * cap, and it returns false. Only then is anything actually delivered, so a
 * retry can never turn into a second buzz.
 */
async function deliver(
  userId: string,
  settings: Settings | undefined,
  kind: "rival_passed" | "week_result" | "streak_reminder",
  dedupeKey: string,
  title: string,
  body: string,
  url: string,
  email: string | undefined,
  hasDevice: boolean
): Promise<"sent" | "off" | "asleep" | "duplicate" | "nowhere"> {
  const prefs = settings ?? {
    user_id: userId,
    push_enabled: true,
    email_enabled: true,
    rival_alerts: true,
    week_result: true,
    streak_reminder: true,
    timezone: "America/New_York",
  };

  const kindEnabled =
    kind === "rival_passed"
      ? prefs.rival_alerts
      : kind === "week_result"
        ? prefs.week_result
        : prefs.streak_reminder;

  if (!kindEnabled) return "off";
  if (!isAwakeHour(prefs.timezone)) return "asleep";

  const wantsPush = prefs.push_enabled && pushConfigured && hasDevice;
  const wantsEmail = prefs.email_enabled && emailConfigured && Boolean(email);

  /*
    A channel of "none" is recorded but does not count against the daily cap,
    so somebody who has turned everything off, or never turned anything on,
    never has their three spent on messages that reached nowhere. The row is
    still written, which is what keeps the same event from being reconsidered
    on every pass for the rest of the day.
  */
  const channel = wantsPush ? "push" : wantsEmail ? "email" : "none";

  const admin = createAdminClient();
  const { data: claimed } = await admin.rpc("record_notification", {
    p_user_id: userId,
    p_kind: kind,
    p_dedupe_key: dedupeKey,
    p_title: title,
    p_body: body,
    p_url: url,
    p_channel: channel,
    p_daily_cap: DAILY_CAP,
  });

  if (claimed !== true) return "duplicate";
  if (channel === "none") return "nowhere";

  const message = { title, body, url };

  if (channel === "push") {
    const { delivered } = await sendPush(userId, message);
    // Nobody actually had a browser listening. Email is the fallback the plan
    // asks for precisely because push reaches so few people on iOS.
    if (delivered === 0 && wantsEmail && email) {
      await sendEmail(email, message);
    }
    return "sent";
  }

  if (email) await sendEmail(email, message);
  return "sent";
}

/**
 * Looks at every league, works out who was genuinely passed since the last
 * pass, and tells them by name.
 */
export async function notifyStandingChanges(): Promise<NotifyResult> {
  const result: NotifyResult = { considered: 0, sent: 0, skipped: {} };
  if (!canWriteGame) return result;

  const admin = createAdminClient();
  const today = nyDate();

  // Only while the market is open. A rank that changed overnight changed
  // because prices moved, not because anyone did anything.
  if (!isTradingDay(today) || !isTradingOpen()) {
    result.skipped.market_closed = 1;
    return result;
  }

  const { data: leagues } = await admin.from("leagues").select("id");

  for (const league of (leagues ?? []) as { id: string }[]) {
    const { data: members } = await admin
      .from("league_members")
      .select("user_id, last_rank")
      .eq("league_id", league.id);

    const roster = (members ?? []) as { user_id: string; last_rank: number | null }[];
    if (roster.length < 2) continue;

    // Standings are read as one of the members, since the function checks
    // membership before it will show anything.
    const standings = await getLeagueStandings(roster[0].user_id, league.id);
    if (!standings) continue;

    const previous = new Map(roster.map((m) => [m.user_id, m.last_rank]));
    const ranks: Record<string, number> = {};
    for (const row of standings.standings) ranks[row.userId] = row.rank;

    const userIds = standings.standings.map((s) => s.userId);
    const [prefs, emails, devices] = await Promise.all([
      settingsFor(userIds),
      emailConfigured ? emailsFor(userIds) : Promise.resolve(new Map<string, string>()),
      devicesFor(userIds),
    ]);

    for (const row of standings.standings) {
      const before = previous.get(row.userId);

      // No history yet, or they did not drop. Nothing happened to them.
      if (before == null || row.rank <= before) continue;

      /*
        Who actually passed them: someone who was behind before and is ahead
        now. The nearest such person is the one worth naming, because a single
        named rival beats a list of strangers.
      */
      const overtook = standings.standings
        .filter((other) => {
          const otherBefore = previous.get(other.userId);
          return (
            other.userId !== row.userId &&
            otherBefore != null &&
            otherBefore > before &&
            other.rank < row.rank
          );
        })
        .sort((a, b) => b.rank - a.rank)[0];

      if (!overtook) continue;

      result.considered++;

      const gap = formatGap(overtook.returnPercent - row.returnPercent);
      const outcome = await deliver(
        row.userId,
        prefs.get(row.userId),
        "rival_passed",
        `passed:${league.id}:${overtook.userId}:${today}`,
        `${overtook.displayName} passed you`,
        `${overtook.displayName} is ${gap} ahead in ${standings.league.name}. There is still time today.`,
        `/leagues/${league.id}`,
        emails.get(row.userId),
        devices.has(row.userId)
      );

      if (outcome === "sent") result.sent++;
      else result.skipped[outcome] = (result.skipped[outcome] ?? 0) + 1;
    }

    await admin.rpc("update_member_ranks", {
      p_league_id: league.id,
      p_ranks: ranks,
    });
  }

  return result;
}

/**
 * Tells people their week has been scored.
 *
 * Sent to everyone whose week finished, win or lose, because a result is a
 * fact rather than a judgement. What it never does is frame a bad week as
 * something one more trade could fix.
 */
export async function notifyWeekResults(): Promise<NotifyResult> {
  const result: NotifyResult = { considered: 0, sent: 0, skipped: {} };
  if (!canWriteGame) return result;

  const admin = createAdminClient();

  const { data: cycles } = await admin
    .from("weekly_cycles")
    .select("id, monday")
    .eq("status", "closed")
    .order("monday", { ascending: false })
    .limit(1);

  const cycle = (cycles ?? [])[0] as { id: string; monday: string } | undefined;
  if (!cycle) return result;

  const { data: portfolios } = await admin
    .from("portfolios")
    .select("user_id, return_percent, benchmark_diff")
    .eq("cycle_id", cycle.id)
    .not("return_percent", "is", null);

  const rows = (portfolios ?? []) as {
    user_id: string;
    return_percent: string;
    benchmark_diff: string;
  }[];
  if (rows.length === 0) return result;

  const userIds = rows.map((r) => r.user_id);
  const [prefs, emails, devices] = await Promise.all([
    settingsFor(userIds),
    emailConfigured ? emailsFor(userIds) : Promise.resolve(new Map<string, string>()),
    devicesFor(userIds),
  ]);

  for (const row of rows) {
    result.considered++;

    const ret = Number(row.return_percent);
    const diff = Number(row.benchmark_diff);
    const beat = diff >= 0;

    const outcome = await deliver(
      row.user_id,
      prefs.get(row.user_id),
      "week_result",
      `week:${cycle.monday}`,
      "Your week is in",
      beat
        ? `You finished ${formatGap(diff)} ahead of the market. A new week starts Monday with the same money for everyone.`
        : `You finished ${formatGap(diff)} behind the market. A new week starts Monday with the same money for everyone.`,
      "/home",
      emails.get(row.user_id),
      devices.has(row.user_id)
    );

    if (outcome === "sent") result.sent++;
    else result.skipped[outcome] = (result.skipped[outcome] ?? 0) + 1;

    void ret;
  }

  return result;
}

/**
 * A single reminder, late in the trading day, to anyone with a streak going
 * who has not been counted yet.
 *
 * This is the one notification that is about the player rather than the game,
 * and it earns its place the way section 3 asks: a real deadline, today's
 * close, and a real ten-second action, open the app. It is never sent to
 * someone with no streak, because there would be nothing true to say.
 */
export async function notifyStreaksAtRisk(): Promise<NotifyResult> {
  const result: NotifyResult = { considered: 0, sent: 0, skipped: {} };
  if (!canWriteGame) return result;

  const today = nyDate();
  if (!isTradingDay(today)) {
    result.skipped.not_a_trading_day = 1;
    return result;
  }

  // Late in the New York day and no earlier. The reasoning is in timing.ts.
  if (!isStreakReminderHour()) {
    result.skipped.too_early = 1;
    return result;
  }

  const admin = createAdminClient();
  const { data } = await admin
    .from("streaks")
    .select("user_id, current_streak, last_active_date, freezes_available")
    .gt("current_streak", 0)
    .neq("last_active_date", today);

  const rows = (data ?? []) as {
    user_id: string;
    current_streak: number;
    last_active_date: string | null;
    freezes_available: number;
  }[];
  if (rows.length === 0) return result;

  const userIds = rows.map((r) => r.user_id);
  const [prefs, emails, devices] = await Promise.all([
    settingsFor(userIds),
    emailConfigured ? emailsFor(userIds) : Promise.resolve(new Map<string, string>()),
    devicesFor(userIds),
  ]);

  for (const row of rows) {
    result.considered++;

    const outcome = await deliver(
      row.user_id,
      prefs.get(row.user_id),
      "streak_reminder",
      `streak:${today}`,
      `Your ${row.current_streak} day streak`,
      row.freezes_available > 0
        ? "Today is not counted yet. Opening Arena is enough, and you have a freeze if you miss it."
        : "Today is not counted yet. Opening Arena is enough.",
      "/home",
      emails.get(row.user_id),
      devices.has(row.user_id)
    );

    if (outcome === "sent") result.sent++;
    else result.skipped[outcome] = (result.skipped[outcome] ?? 0) + 1;
  }

  return result;
}
