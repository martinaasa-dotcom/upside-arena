import "server-only";

import { canWriteGame } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import type { PodRow, PodMemberRow } from "@/lib/supabase/database.types";

/*
  Public matchmade pods, from section 2.2.

  Roughly twenty to thirty people, a rung on a bronze to diamond ladder, and
  promotion or relegation every week from the rating phase 1 put on the
  profile for exactly this purpose.

  The same section is emphatic about when this should be switched on: not
  until there is real concurrent volume, "or pods will feel dead". That is
  what PODS_MINIMUM decides. Below it nobody is placed and no pod screen is
  offered, so the feature can sit finished and dormant rather than shipping a
  room with one person in it. The database will happily place a single player
  into a pod of one; the point of the switch is that we do not ask it to.
*/

/**
 * How many people have to be playing a week before pods are worth having.
 *
 * A pod needs enough people that a placing means something and that promotion
 * is not simply whoever turned up. Two full pods is the smallest number that
 * makes a ladder rather than a leaderboard with a title.
 */
export const PODS_MINIMUM = 48;

/** What the plan asks a pod to hold. */
export const POD_TARGET_SIZE = 24;

export type PodTier = "bronze" | "silver" | "gold" | "diamond";

export const TIER_NAMES: Record<PodTier, string> = {
  bronze: "Bronze",
  silver: "Silver",
  gold: "Gold",
  diamond: "Diamond",
};

export type PodStanding = {
  userId: string;
  displayName: string;
  handle: string | null;
  avatarUrl: string | null;
  rank: number;
  returnPercent: number;
  versusMarket: number | null;
  isYou: boolean;
  hasTraded: boolean;
};

export type PodView = {
  pod: { id: string; tier: PodTier; number: number; name: string };
  standings: PodStanding[];
  /** How many go up and down at the end of this week, from this pod. */
  moving: number;
  /*
    The gap to the last promotion place, when somebody is not in one. Section 3
    permits a near miss only when it is real, so this is a measured difference
    and is null whenever there is nothing true to say.
  */
  toPromotion: number | null;
  /** And the gap somebody in the drop zone has to climb to be safe. */
  toSafety: number | null;
};

/**
 * Whether pods should be running at all this week.
 *
 * Counted rather than configured, so the feature switches itself on when the
 * game is busy enough to carry it and back off if it ever is not.
 */
export async function podsAreWorthRunning(cycleId: string): Promise<boolean> {
  if (!canWriteGame) return false;

  const admin = createAdminClient();
  const { count } = await admin
    .from("portfolios")
    .select("id", { count: "exact", head: true })
    .eq("cycle_id", cycleId);

  return (count ?? 0) >= PODS_MINIMUM;
}

/**
 * Puts somebody in a pod for the week, if pods are running.
 *
 * Safe to call on every visit: the database seats a player once a week and
 * returns the same pod thereafter.
 */
export async function placeInPod(
  userId: string,
  cycleId: string
): Promise<PodRow | null> {
  if (!(await podsAreWorthRunning(cycleId))) return null;

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("place_in_pod", {
    p_user_id: userId,
    p_cycle_id: cycleId,
    p_target_size: POD_TARGET_SIZE,
  });

  if (error) return null;
  return data as unknown as PodRow;
}

/** Settles every pod whose week has been scored. */
export async function settleDuePods(): Promise<number> {
  if (!canWriteGame) return 0;

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("due_pods");
  if (error || !Array.isArray(data)) return 0;

  let settled = 0;
  for (const pod of data as PodRow[]) {
    const { error: podError } = await admin.rpc("settle_pod", { p_pod_id: pod.id });
    // A pod that would not settle is left for the next attempt. Settling is
    // idempotent and does not part-apply, so there is nothing to undo.
    if (!podError) settled += 1;
  }

  return settled;
}

function num(value: string | number | null | undefined): number {
  if (value == null) return 0;
  return typeof value === "number" ? value : Number(value);
}

/** The pod somebody is in this week, priced from the settled figures. */
export async function getPodView(
  userId: string,
  cycleId: string,
  benchmarkReturnPercent: number | null
): Promise<PodView | null> {
  if (!canWriteGame) return null;

  const admin = createAdminClient();

  const { data: mine } = await admin
    .from("pod_members")
    .select("pod_id")
    .eq("user_id", userId)
    .maybeSingle();

  const podId = (mine as { pod_id: string } | null)?.pod_id;
  if (!podId) return null;

  const [{ data: pod }, { data: members }] = await Promise.all([
    admin.from("pods").select("*").eq("id", podId).maybeSingle(),
    admin.from("pod_members").select("*").eq("pod_id", podId),
  ]);

  if (!pod || (pod as PodRow).cycle_id !== cycleId) return null;

  const rows = (members ?? []) as PodMemberRow[];
  const ids = rows.map((row) => row.user_id);
  if (ids.length === 0) return null;

  const [{ data: profiles }, { data: portfolios }] = await Promise.all([
    admin.from("profiles").select("id, display_name, handle, avatar_url").in("id", ids),
    admin
      .from("portfolios")
      .select("user_id, return_percent, benchmark_diff, id")
      .eq("cycle_id", cycleId)
      .in("user_id", ids),
  ]);

  const profileById = new Map(
    ((profiles ?? []) as { id: string; display_name: string | null; handle: string | null; avatar_url: string | null }[])
      .map((p) => [p.id, p])
  );
  const portfolioBy = new Map(
    ((portfolios ?? []) as { user_id: string; return_percent: string | null; benchmark_diff: string | null }[])
      .map((p) => [p.user_id, p])
  );

  const scored = ids.map((id) => {
    const profile = profileById.get(id);
    const portfolio = portfolioBy.get(id);
    const returnPercent = num(portfolio?.return_percent);

    return {
      userId: id,
      displayName: profile?.display_name ?? "Player",
      handle: profile?.handle ?? null,
      avatarUrl: profile?.avatar_url ?? null,
      returnPercent,
      versusMarket:
        benchmarkReturnPercent == null ? null : returnPercent - benchmarkReturnPercent,
      isYou: id === userId,
      hasTraded: portfolio != null,
    };
  });

  scored.sort((a, b) => b.returnPercent - a.returnPercent);
  const standings: PodStanding[] = scored.map((row, index) => ({
    ...row,
    rank: index + 1,
  }));

  /*
    How many move, mirroring the rule the database settles on. A pod too thin
    for that to mean anything moves nobody, and then there is no promotion
    place to be near and nothing to say about it.
  */
  const moving = standings.length < 8 ? 0 : Math.max(1, Math.floor(standings.length * 0.2));

  const you = standings.find((row) => row.isYou);
  const lastPromoted = moving > 0 ? standings[moving - 1] : undefined;
  const firstRelegated =
    moving > 0 ? standings[standings.length - moving] : undefined;

  return {
    pod: {
      id: (pod as PodRow).id,
      tier: (pod as PodRow).tier as PodTier,
      number: (pod as PodRow).number,
      name: `${TIER_NAMES[(pod as PodRow).tier as PodTier]} pod ${(pod as PodRow).number}`,
    },
    standings,
    moving,
    toPromotion:
      you && lastPromoted && you.rank > moving
        ? lastPromoted.returnPercent - you.returnPercent
        : null,
    toSafety:
      you && firstRelegated && you.rank >= standings.length - moving + 1
        ? standings[standings.length - moving - 1].returnPercent - you.returnPercent
        : null,
  };
}
