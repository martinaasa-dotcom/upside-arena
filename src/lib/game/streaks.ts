import "server-only";

import { canWriteGame } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordDailyActive } from "@/lib/metrics";
import {
  cycleMonday,
  isTradingDay,
  nyDate,
  tradingDaysBetween,
} from "@/lib/market/session";
import type { RewardRow, StreakRow } from "@/lib/supabase/database.types";

/*
  Showing up, counted in trading days.

  The trigger is opening the app and looking at your portfolio, which is what
  the plan says to start with. It is credited on the home screen and nowhere
  else, so a streak means the one thing it claims to mean.

  Nothing here is spectacular on its own. What makes a streak work is that it
  is true: it counts days you actually turned up, on days the game actually
  ran, and losing it costs you the streak and nothing else.
*/

export type Streak = {
  current: number;
  longest: number;
  lastActive: string | null;
  freezesAvailable: number;
  freezesUsed: number;
  /** True once today has been counted. */
  countedToday: boolean;
  /** Trading days to the next title, or null when they are all earned. */
  toNextMilestone: number | null;
  nextMilestone: { id: string; name: string; at: number } | null;
};

export type EarnedReward = {
  id: string;
  name: string;
  description: string;
};

function toStreak(
  row: StreakRow,
  today: string,
  milestones: RewardRow[]
): Streak {
  const current = row.current_streak;

  const next = milestones
    .filter((m) => m.streak_required != null && m.streak_required > current)
    .sort((a, b) => (a.streak_required ?? 0) - (b.streak_required ?? 0))[0];

  return {
    current,
    longest: row.longest_streak,
    lastActive: row.last_active_date,
    freezesAvailable: row.freezes_available,
    freezesUsed: row.freezes_used,
    countedToday: row.last_active_date === today,
    toNextMilestone: next ? (next.streak_required ?? 0) - current : null,
    nextMilestone: next
      ? { id: next.id, name: next.name, at: next.streak_required ?? 0 }
      : null,
  };
}

/**
 * Credits today to the player's streak and returns where they stand.
 *
 * Safe to call on every home screen render: the database counts a day once,
 * however many times it is told about it.
 */
export async function recordVisit(userId: string): Promise<{
  streak: Streak;
  earned: EarnedReward[];
} | null> {
  if (!canWriteGame) return null;

  const admin = createAdminClient();
  const today = nyDate();

  /*
    Noted as a visit before anything else, and on every day rather than only
    on trading days. A streak deliberately ignores the weekend; retention must
    not, because somebody who came back on a Saturday came back.
  */
  await recordDailyActive(userId);

  /*
    A visit at the weekend is not a missed day and not a credited one either.
    Reading the streak without touching it means someone checking in on a
    Sunday sees the truth rather than having Friday quietly overwritten.
  */
  if (!isTradingDay(today)) {
    return readStreak(userId);
  }

  const { data: existing } = await admin
    .from("streaks")
    .select("last_active_date")
    .eq("user_id", userId)
    .maybeSingle();

  const lastActive = (existing as { last_active_date: string | null } | null)
    ?.last_active_date;

  /*
    Trading days strictly between the last visit and today is exactly how many
    were skipped: yesterday leaves none, a gap over a weekend leaves none, and
    a Monday missed between Friday and Tuesday leaves one.
  */
  const missed = lastActive ? tradingDaysBetween(lastActive, today) : 0;

  const before = await ownedRewardIds(userId);

  const { data, error } = await admin.rpc("record_activity", {
    p_user_id: userId,
    p_today: today,
    p_missed_days: missed,
    p_week_monday: cycleMonday(),
  });

  if (error || !data) return readStreak(userId);

  const milestones = await getCatalogue();
  const after = await ownedRewardIds(userId);
  const fresh = [...after].filter((id) => !before.has(id));

  return {
    streak: toStreak(data as unknown as StreakRow, today, milestones),
    earned: milestones
      .filter((m) => fresh.includes(m.id))
      .map((m) => ({ id: m.id, name: m.name, description: m.description })),
  };
}

/** The streak as it stands, without crediting anything. */
export async function readStreak(userId: string): Promise<{
  streak: Streak;
  earned: EarnedReward[];
} | null> {
  if (!canWriteGame) return null;

  const admin = createAdminClient();
  const today = nyDate();

  const { data } = await admin
    .from("streaks")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  const milestones = await getCatalogue();

  const row = (data as StreakRow | null) ?? {
    user_id: userId,
    current_streak: 0,
    longest_streak: 0,
    last_active_date: null,
    freezes_available: 1,
    freezes_used: 0,
    freeze_granted_week: null,
    updated_at: new Date().toISOString(),
  };

  return { streak: toStreak(row, today, milestones), earned: [] };
}

let catalogue: RewardRow[] | null = null;

/** The reward catalogue. Fixed content, so it is read once per process. */
async function getCatalogue(): Promise<RewardRow[]> {
  if (catalogue) return catalogue;
  if (!canWriteGame) return [];

  const admin = createAdminClient();
  const { data } = await admin.from("rewards").select("*").order("sort_order");
  catalogue = (data ?? []) as RewardRow[];
  return catalogue;
}

async function ownedRewardIds(userId: string): Promise<Set<string>> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("user_rewards")
    .select("reward_id")
    .eq("user_id", userId);
  return new Set(((data ?? []) as { reward_id: string }[]).map((r) => r.reward_id));
}

export type OwnedReward = EarnedReward & {
  earnedAt: string;
  equipped: boolean;
};

/** Every title a player has earned, and which one they are wearing. */
export async function getRewards(userId: string): Promise<{
  owned: OwnedReward[];
  locked: (EarnedReward & { streakRequired: number | null })[];
  equipped: string | null;
}> {
  if (!canWriteGame) return { owned: [], locked: [], equipped: null };

  const admin = createAdminClient();
  const [catalogueRows, { data: mine }, { data: profile }] = await Promise.all([
    getCatalogue(),
    admin.from("user_rewards").select("reward_id, earned_at").eq("user_id", userId),
    admin.from("profiles").select("equipped_title").eq("id", userId).maybeSingle(),
  ]);

  const equipped =
    (profile as { equipped_title: string | null } | null)?.equipped_title ?? null;

  const earnedAt = new Map(
    ((mine ?? []) as { reward_id: string; earned_at: string }[]).map((r) => [
      r.reward_id,
      r.earned_at,
    ])
  );

  const owned: OwnedReward[] = [];
  const locked: (EarnedReward & { streakRequired: number | null })[] = [];

  for (const row of catalogueRows) {
    const when = earnedAt.get(row.id);
    if (when) {
      owned.push({
        id: row.id,
        name: row.name,
        description: row.description,
        earnedAt: when,
        equipped: equipped === row.id,
      });
    } else {
      locked.push({
        id: row.id,
        name: row.name,
        description: row.description,
        streakRequired: row.streak_required,
      });
    }
  }

  return { owned, locked, equipped };
}

export async function equipTitle(
  userId: string,
  rewardId: string | null
): Promise<{ ok: boolean; error?: string }> {
  if (!canWriteGame) return { ok: false, error: "Titles are not switched on yet." };

  const admin = createAdminClient();
  const { error } = await admin.rpc("equip_title", {
    p_user_id: userId,
    p_reward_id: rewardId,
  });

  if (error) {
    return error.message.includes("not earned")
      ? { ok: false, error: "You have not earned that title yet." }
      : { ok: false, error: "We could not change your title. Try again." };
  }

  return { ok: true };
}

/** Hands over a title that is not about streaks, such as a first trade. */
export async function grantReward(userId: string, rewardId: string) {
  if (!canWriteGame) return false;
  const admin = createAdminClient();
  const { data } = await admin.rpc("grant_reward", {
    p_user_id: userId,
    p_reward_id: rewardId,
  });
  return data === true;
}
