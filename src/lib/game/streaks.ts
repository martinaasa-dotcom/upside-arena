import "server-only";

import { canWriteGame } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordDailyActive } from "@/lib/metrics";
import { hasPlus } from "@/lib/billing/entitlements";
import { limitsFor } from "@/lib/billing/plan";
import {
  cycleMonday,
  isTradingDay,
  nyDate,
  tradingDaysBetween,
} from "@/lib/market/session";
import type {
  CosmeticSlot,
  RewardRow,
  StreakRow,
} from "@/lib/supabase/database.types";

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

export type { CosmeticSlot } from "@/lib/supabase/database.types";

/** Something not yet owned, with what earns it. */
export type LockedReward = EarnedReward & {
  kind: CosmeticSlot;
  streakRequired: number | null;
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

  /*
    How many freezes the weekly grant lifts them to. A subscriber gets more,
    which is convenience rather than advantage: a freeze covers a day nobody
    opened the app, and a streak has never touched a standing or a lifetime
    figure.
  */
  const limits = limitsFor(await hasPlus(userId));

  const { data, error } = await admin.rpc("record_activity", {
    p_user_id: userId,
    p_today: today,
    p_missed_days: missed,
    p_week_monday: cycleMonday(),
    p_weekly_freezes: limits.weeklyFreezes,
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
  kind: CosmeticSlot;
  styleKey: string | null;
  earnedAt: string;
  equipped: boolean;
};

/** A cosmetic that can be bought outright, at a price that never varies. */
export type ForSaleReward = EarnedReward & {
  kind: CosmeticSlot;
  coinPrice: number | null;
  plusOnly: boolean;
  styleKey: string | null;
};

/** Every title a player has earned, and which one they are wearing. */
export type Wardrobe = {
  owned: OwnedReward[];
  locked: LockedReward[];
  /** The ones with a price on them, or that come with a subscription. */
  forSale: ForSaleReward[];
  /** What is being worn in each slot. */
  equipped: Record<CosmeticSlot, string | null>;
};

const NOTHING_WORN: Record<CosmeticSlot, string | null> = {
  title: null,
  flair: null,
  theme: null,
};

export async function getRewards(userId: string): Promise<Wardrobe> {
  if (!canWriteGame) {
    return { owned: [], locked: [], forSale: [], equipped: { ...NOTHING_WORN } };
  }

  const admin = createAdminClient();
  const [catalogueRows, { data: mine }, { data: profile }] = await Promise.all([
    getCatalogue(),
    admin.from("user_rewards").select("reward_id, earned_at").eq("user_id", userId),
    admin
      .from("profiles")
      .select("equipped_title, equipped_flair, equipped_theme")
      .eq("id", userId)
      .maybeSingle(),
  ]);

  const worn = profile as {
    equipped_title: string | null;
    equipped_flair: string | null;
    equipped_theme: string | null;
  } | null;

  const equipped: Record<CosmeticSlot, string | null> = {
    title: worn?.equipped_title ?? null,
    flair: worn?.equipped_flair ?? null,
    theme: worn?.equipped_theme ?? null,
  };

  const earnedAt = new Map(
    ((mine ?? []) as { reward_id: string; earned_at: string }[]).map((r) => [
      r.reward_id,
      r.earned_at,
    ])
  );

  const owned: OwnedReward[] = [];
  const locked: LockedReward[] = [];
  const forSale: ForSaleReward[] = [];

  for (const row of catalogueRows) {
    const when = earnedAt.get(row.id);

    if (when) {
      owned.push({
        id: row.id,
        kind: row.kind,
        styleKey: row.style_key,
        name: row.name,
        description: row.description,
        earnedAt: when,
        equipped: equipped[row.kind] === row.id,
      });
      continue;
    }

    /*
      Bought or given with a subscription, rather than earned. Kept out of
      "still to earn" so that list stays a list of things playing gets you,
      which is the only reason it is worth looking at.
    */
    if (row.coin_price != null || row.plus_only) {
      forSale.push({
        id: row.id,
        kind: row.kind,
        styleKey: row.style_key,
        name: row.name,
        description: row.description,
        coinPrice: row.coin_price,
        plusOnly: row.plus_only,
      });
      continue;
    }

    locked.push({
      id: row.id,
      kind: row.kind,
      name: row.name,
      description: row.description,
      streakRequired: row.streak_required,
    });
  }

  return { owned, locked, forSale, equipped };
}

export async function equipCosmetic(
  userId: string,
  rewardId: string | null,
  slot: CosmeticSlot
): Promise<{ ok: boolean; error?: string }> {
  if (!canWriteGame) return { ok: false, error: "That is not switched on yet." };

  const admin = createAdminClient();
  const { error } = await admin.rpc("equip_cosmetic", {
    p_user_id: userId,
    p_reward_id: rewardId,
    p_slot: slot,
  });

  if (error) {
    const message = error.message ?? "";
    if (message.includes("not earned")) {
      return { ok: false, error: "You do not have that one yet." };
    }
    if (message.includes("does not go there")) {
      return { ok: false, error: "That does not go in that slot." };
    }
    return { ok: false, error: "We could not change that. Try again." };
  }

  return { ok: true };
}

/** What somebody is wearing, for the pages that only need to draw it. */
export async function getWorn(
  userId: string
): Promise<Record<CosmeticSlot, string | null>> {
  if (!canWriteGame) return { ...NOTHING_WORN };

  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("equipped_title, equipped_flair, equipped_theme")
    .eq("id", userId)
    .maybeSingle();

  const worn = data as {
    equipped_title: string | null;
    equipped_flair: string | null;
    equipped_theme: string | null;
  } | null;

  return {
    title: worn?.equipped_title ?? null,
    flair: worn?.equipped_flair ?? null,
    theme: worn?.equipped_theme ?? null,
  };
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
