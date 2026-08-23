import "server-only";

import { canWriteGame } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { getLeagueStandings } from "@/lib/game/leagues";
import {
  settledBattles,
  startedBattles,
  type BattleResult,
  type StartedBattle,
} from "@/lib/game/battles";
import {
  TIER_NAMES,
  podOutcomesFor,
  settleDuePods,
  type PodOutcome,
} from "@/lib/game/pods";
import { isTradingDay, isTradingOpen, nyDate } from "@/lib/market/session";
import { formatDate, formatGap, ordinal } from "@/lib/format";
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
  league_activity: boolean;
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
  kind:
    | "rival_passed"
    | "week_result"
    | "streak_reminder"
    | "battle_result"
    | "battle_started",
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
    league_activity: true,
    timezone: "America/New_York",
  };

  /*
    Two of these share a switch and one has its own, and the difference is
    worth stating because it looks arbitrary.

    A settled battle is gated by week_result. "Do you want to be told a
    contest you were in has been scored" is the question that toggle already
    asks, and asking it twice would be two switches for one preference.

    A battle starting is not that question. The switch it sits nearest is
    rival_alerts, which fires while the market is open and can fire often,
    where a league starting a contest is rare. Folding it in would mean
    somebody turning off the noisy one lost the rare one with it -- far more
    than they said with that tap. See 0023.
  */
  const kindEnabled =
    kind === "rival_passed"
      ? prefs.rival_alerts
      : kind === "week_result" || kind === "battle_result"
        ? prefs.week_result
        : kind === "battle_started"
          ? prefs.league_activity
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
    // The house week. "Your week is in" is about the race everybody is in,
    // and a league's battle settling on a Wednesday must not send it.
    .is("league_id", null)
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

  /*
    Settle the week's pods first, for the same reason the marks job runs before
    anything is sent about the day: this message is sent once, keyed on the
    week, so whatever is true when it goes out is what the player is ever told.
    Settling and notifying are two separate cron jobs and nothing orders them,
    so without this a promotion is announced or silently dropped depending on
    which one Vercel happened to call first. Idempotent, and a no-op when there
    is nothing due.
  */
  await settleDuePods();

  const userIds = rows.map((r) => r.user_id);
  const [prefs, emails, devices, pods] = await Promise.all([
    settingsFor(userIds),
    emailConfigured ? emailsFor(userIds) : Promise.resolve(new Map<string, string>()),
    devicesFor(userIds),
    podOutcomesFor(cycle.id, userIds),
  ]);

  for (const row of rows) {
    result.considered++;

    const diff = Number(row.benchmark_diff);
    const pod = pods.get(row.user_id);

    const message = weekResultMessage(diff, pod);

    const outcome = await deliver(
      row.user_id,
      prefs.get(row.user_id),
      "week_result",
      `week:${cycle.monday}`,
      message.title,
      message.body,
      message.href,
      emails.get(row.user_id),
      devices.has(row.user_id)
    );

    if (outcome === "sent") result.sent++;
    else result.skipped[outcome] = (result.skipped[outcome] ?? 0) + 1;
  }

  return result;
}

/**
 * What a settled week says to one player.
 *
 * Pure, and separate from sending it, because this is the whole of what a
 * person actually receives and it is worth being able to read it back in a
 * test rather than from a phone.
 *
 * The ladder goes inside the message the player already gets rather than
 * arriving as a second one. Two rules from the top of this file still hold.
 *
 * It says nothing about doing something about it. A relegation with "one good
 * week gets it back" attached is a loss messaged as fixable by trading again,
 * which is the thing this file will not send. A placing that already happened,
 * with no call to action, is a result — the same kind of thing as the market
 * line beside it, which has always been sent whichever way it went.
 *
 * And it is only there for somebody who moved. Being told you stayed where you
 * were is a notification about nothing, which is why podOutcomesFor returns
 * only the players the ladder actually moved.
 */
export function weekResultMessage(
  benchmarkDiff: number,
  pod?: PodOutcome
): { title: string; body: string; href: string } {
  const market =
    benchmarkDiff >= 0
      ? `You finished ${formatGap(benchmarkDiff)} ahead of the market.`
      : `You finished ${formatGap(benchmarkDiff)} behind the market.`;

  const next = "A new week starts Monday with the same money for everyone.";

  if (!pod) {
    return { title: "Your week is in", body: `${market} ${next}`, href: "/home" };
  }

  // A placing of nothing is not a placing. settle_pod always writes one, but
  // rendering a missing one as "0th" would be worse than saying less.
  const place = pod.finalRank > 0 ? ordinal(pod.finalRank) : null;
  const where =
    place && pod.members > 0
      ? `${place} of ${pod.members} in ${pod.podName}`
      : place
        ? `${place} in ${pod.podName}`
        : `in ${pod.podName}`;

  const rung = pod.tierNow ? ` You are in ${TIER_NAMES[pod.tierNow]} now.` : "";
  const up = pod.moved === "promoted";

  return {
    title: up ? "You went up a rung" : "You dropped a rung",
    body: `You finished ${where} and go ${up ? "up" : "down"}.${rung} ${market} ${next}`,
    href: "/leagues",
  };
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

/*
  Telling a league that its battle has been settled.

  A battle can run for a year and used to end in silence: the only way to find
  out you had won one was to happen to open the room afterwards. A contest
  whose result nobody is told is a contest people play once.

  The same three rules the rest of this file follows still hold. It describes
  something that actually happened, with a name attached. It says nothing about
  doing anything about it -- no "start another", no "get your own back", which
  would be a loss messaged as fixable by playing again. And it goes to everyone
  who was scored in it, winner and last alike, because a result is a result
  whichever end of it you are on.
*/
export async function notifyBattleResults(): Promise<NotifyResult> {
  const result: NotifyResult = { considered: 0, sent: 0, skipped: {} };
  if (!canWriteGame) return result;

  const battles = await settledBattles();
  if (battles.length === 0) return result;

  const everybody = [
    ...new Set(battles.flatMap((battle) => battle.finished.map((row) => row.userId))),
  ];

  const [prefs, emails, devices] = await Promise.all([
    settingsFor(everybody),
    emailConfigured ? emailsFor(everybody) : Promise.resolve(new Map<string, string>()),
    devicesFor(everybody),
  ]);

  for (const battle of battles) {
    const present = new Set(battle.present);

    for (const [index, player] of battle.finished.entries()) {
      /*
        Everybody who was in it counts towards the field, so a winner who has
        since left the league does not have their win handed to second place.
        Only the people still in it are told, because the message links to a
        room that league membership is what opens.
      */
      if (!present.has(player.userId)) continue;

      result.considered++;

      const message = battleResultMessage(battle, index + 1);

      /*
        Keyed on the battle rather than on the day. This runs on a schedule
        that may fire twice, or a week late, and the key is the only thing
        that decides whether somebody hears about a result twice.
      */
      const outcome = await deliver(
        player.userId,
        prefs.get(player.userId),
        "battle_result",
        `battle:${battle.cycleId}`,
        message.title,
        message.body,
        message.href,
        emails.get(player.userId),
        devices.has(player.userId)
      );

      if (outcome === "sent") result.sent++;
      else result.skipped[outcome] = (result.skipped[outcome] ?? 0) + 1;
    }
  }

  return result;
}

/**
 * Tells a league that one of its members has started a contest.
 *
 * Everybody in the league is in it from the moment it is made, so this is not
 * an invitation and does not pretend to be one. It is the difference between
 * playing a battle and finding out afterwards that you came last in it.
 *
 * The person who started it is not told. They know.
 */
export async function notifyBattlesStarted(now = new Date()): Promise<NotifyResult> {
  const result: NotifyResult = { considered: 0, sent: 0, skipped: {} };
  if (!canWriteGame) return result;

  const battles = await startedBattles(now);
  if (battles.length === 0) return result;

  const everybody = [
    ...new Set(
      battles.flatMap((battle) =>
        battle.players.filter((userId) => userId !== battle.createdBy)
      )
    ),
  ];
  if (everybody.length === 0) return result;

  const [prefs, emails, devices] = await Promise.all([
    settingsFor(everybody),
    emailConfigured ? emailsFor(everybody) : Promise.resolve(new Map<string, string>()),
    devicesFor(everybody),
  ]);

  for (const battle of battles) {
    const message = battleStartedMessage(battle);

    for (const userId of battle.players) {
      if (userId === battle.createdBy) continue;

      result.considered++;

      /*
        Keyed on the cycle. A battle is announced once however often this
        runs, and a league that starts a second battle after the first
        finishes gets a second announcement because it is a different cycle.
      */
      const outcome = await deliver(
        userId,
        prefs.get(userId),
        "battle_started",
        `battle-started:${battle.cycleId}`,
        message.title,
        message.body,
        message.href,
        emails.get(userId),
        devices.has(userId)
      );

      if (outcome === "sent") result.sent++;
      else result.skipped[outcome] = (result.skipped[outcome] ?? 0) + 1;
    }
  }

  return result;
}

/**
 * What a started battle says.
 *
 * Ordered for a lock screen rather than for a page. Every one of these bodies
 * is longer than a phone will show, so the order is the message: how long it
 * runs, when it ends, and that they are in it whether they do anything or
 * not. All of that inside the first eighty characters.
 *
 * The rule goes last and is the part allowed to be cut. It matters -- turning
 * up to a short-only fortnight and buying what you think will rise is losing
 * on a misunderstanding rather than on a call -- but it is also the one part
 * that is waiting for them in the room when they tap through, and the longest
 * rule in the catalogue is a hundred and thirteen characters on its own.
 */
export function battleStartedMessage(battle: StartedBattle): {
  title: string;
  body: string;
  href: string;
} {
  return {
    title: `${battle.leagueName} started ${battle.format.name}`,
    // The date said the way a person says it. This is a push notification, not
    // a log line, and "ending 2026-08-28" is the app talking to itself.
    body: `${battle.length.name}, ending ${formatDate(battle.endsOn)}. You are in it, so it counts either way. ${battle.format.rule}`,
    href: `/leagues/${battle.leagueId}/battle`,
  };
}

/**
 * What a settled battle says to one player.
 *
 * Pure and separate from sending it, like the week's, because this is the
 * whole of what somebody actually receives and it is worth reading back in a
 * test rather than off a phone.
 */
export function battleResultMessage(
  battle: BattleResult,
  place: number
): { title: string; body: string; href: string } {
  const href = `/leagues/${battle.leagueId}/battle`;
  const where = `${battle.formatName} in ${battle.leagueName}`;

  if (place === 1) {
    return {
      title: `You won ${battle.formatName}`,
      body:
        battle.players === 1
          ? `${where} is settled. You were the only one who played it.`
          : `${where} is settled, and you finished first of ${battle.players}.`,
      href,
    };
  }

  return {
    title: `${where} is settled`,
    body: `${battle.winner?.displayName ?? "Somebody"} won it. You finished ${ordinal(
      place
    )} of ${battle.players}.`,
    href,
  };
}
