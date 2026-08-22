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

/**
 * How many go up and down at the end of a week, out of a pod this size.
 *
 * The same rule settle_pod applies. It lives here as well because the screen
 * has to say what will happen before the week is over, and the two answers
 * have to be the same one.
 */
export function movingFrom(size: number): number {
  return size < 8 ? 0 : Math.max(1, Math.floor(size * 0.2));
}

/** Which way a place in the ladder is heading, if the week ended now. */
export type PodZone = "promoted" | "held" | "relegated";

export function podZone(rank: number, size: number, moving: number): PodZone {
  if (moving === 0) return "held";
  if (rank <= moving) return "promoted";
  if (rank > size - moving) return "relegated";
  return "held";
}

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

/*
  How long an answer to "are pods worth running?" is reused for.

  The question is answered by counting every portfolio in the week, which is
  an exact count over a table that only grows, and it is asked on the way into
  Home and Trade -- so once per room per player per visit, for ever, to
  re-learn a fact about the whole game that nobody's own visit can change.

  Below the threshold, which is where the game is now, the count was the only
  pod work a visit did and it bought nothing. Above it, being a few minutes
  late to notice is not a cost anybody can perceive: the threshold exists to
  keep a pod from feeling dead, not to seat somebody the instant a
  forty-eighth player appears.
*/
const WORTH_RUNNING_TTL_MS = 5 * 60 * 1000;

const worthRunning = new Map<string, { answer: boolean; at: number }>();

/**
 * Whether pods should be running at all this week.
 *
 * Counted rather than configured, so the feature switches itself on when the
 * game is busy enough to carry it and back off if it ever is not. The count
 * is shared between everyone looking, for a few minutes at a time, because it
 * is a fact about the week rather than about the person asking.
 */
export async function podsAreWorthRunning(cycleId: string): Promise<boolean> {
  if (!canWriteGame) return false;

  const known = worthRunning.get(cycleId);
  if (known && Date.now() - known.at < WORTH_RUNNING_TTL_MS) return known.answer;

  const admin = createAdminClient();
  const { count, error } = await admin
    .from("portfolios")
    .select("id", { count: "exact", head: true })
    .eq("cycle_id", cycleId);

  /*
    A failed count is not an answer and is not remembered as one. Caching a
    "no" that came from a broken query would switch pods off for everybody
    for the next five minutes over one bad request.
  */
  if (error) return known?.answer ?? false;

  const answer = (count ?? 0) >= PODS_MINIMUM;

  /*
    Only this week's answer is worth keeping. Last week's cycle id is never
    asked about again, so without this the map would grow by one entry a week
    for the life of the process.
  */
  worthRunning.clear();
  worthRunning.set(cycleId, { answer, at: Date.now() });

  return answer;
}

/** Forgets the cached count. Tests only. */
export function __resetPodGate() {
  worthRunning.clear();
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

/** Where a settled week left somebody, for the message that tells them. */
export type PodOutcome = {
  /** The pod they played, named as the screen names it. */
  podName: string;
  /** Where they finished in it. */
  finalRank: number;
  members: number;
  moved: "promoted" | "held" | "relegated";
  /** The rung the ladder puts them on now, if it changed. */
  tierNow: PodTier | null;
};

/**
 * What each of these players' settled pods did to them last week.
 *
 * Only somebody who actually moved is in the result. A week that left you
 * where you were is not news, and a notification that says nothing happened is
 * the kind section 3 rules out.
 */
export async function podOutcomesFor(
  cycleId: string,
  userIds: string[]
): Promise<Map<string, PodOutcome>> {
  const out = new Map<string, PodOutcome>();
  if (!canWriteGame || userIds.length === 0) return out;

  const admin = createAdminClient();

  /*
    Anything that goes wrong here leaves the map empty, and an empty map is the
    week result exactly as it read before pods existed. A ladder line that
    cannot be built is worth losing; the week result is not.
  */
  const { data: rows } = await admin
    .from("pod_members")
    .select("user_id, final_rank, outcome, pods!inner(id, tier, number, cycle_id, settled_at)")
    .in("user_id", userIds)
    .eq("pods.cycle_id", cycleId)
    .not("pods.settled_at", "is", null)
    .in("outcome", ["promoted", "relegated"]);

  type Row = {
    user_id: string;
    final_rank: number | null;
    outcome: "promoted" | "relegated";
    pods: { id: string; tier: string; number: number };
  };

  const settled = (rows ?? []) as unknown as Row[];
  if (settled.length === 0) return out;

  /*
    Two lookups the rows do not carry: how big each pod was, which is what
    makes a placing mean something, and where each player's rating sits now,
    which is the rung they actually moved onto. The ladder is read from the
    table rather than repeated here, so moving a threshold in a migration
    moves it in the message too.
  */
  const podIds = [...new Set(settled.map((row) => row.pods.id))];
  const [{ data: sizes }, { data: profiles }, { data: ladder }] = await Promise.all([
    admin.from("pod_members").select("pod_id").in("pod_id", podIds),
    admin.from("profiles").select("id, rating").in("id", settled.map((r) => r.user_id)),
    admin.from("pod_tiers").select("tier, min_rating").order("min_rating", { ascending: false }),
  ]);

  const sizeOf = new Map<string, number>();
  for (const row of (sizes ?? []) as { pod_id: string }[]) {
    sizeOf.set(row.pod_id, (sizeOf.get(row.pod_id) ?? 0) + 1);
  }

  const ratingOf = new Map(
    ((profiles ?? []) as { id: string; rating: number | null }[]).map((p) => [
      p.id,
      p.rating ?? 0,
    ])
  );

  const rungs = (ladder ?? []) as { tier: string; min_rating: number }[];
  const tierFor = (rating: number): PodTier | null =>
    (rungs.find((rung) => rung.min_rating <= Math.max(rating, 0))?.tier as PodTier) ?? null;

  for (const row of settled) {
    out.set(row.user_id, {
      podName: `${TIER_NAMES[row.pods.tier as PodTier]} pod ${row.pods.number}`,
      finalRank: row.final_rank ?? 0,
      members: sizeOf.get(row.pods.id) ?? 0,
      moved: row.outcome,
      tierNow: tierFor(ratingOf.get(row.user_id) ?? 0),
    });
  }

  return out;
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

  /*
    Scoped to the week, not just to the player. Somebody who has been playing
    a while has one membership row per pod they have ever been in, so asking
    only for their user id starts returning several the moment they see a
    second week.
  */
  const { data: mine } = await admin
    .from("pod_members")
    .select("pod_id, pods!inner(cycle_id)")
    .eq("user_id", userId)
    .eq("pods.cycle_id", cycleId)
    .maybeSingle();

  const podId = (mine as { pod_id: string } | null)?.pod_id;
  if (!podId) return null;

  const [{ data: pod }, { data: members }] = await Promise.all([
    admin.from("pods").select("*").eq("id", podId).maybeSingle(),
    admin.from("pod_members").select("*").eq("pod_id", podId),
  ]);

  if (!pod) return null;

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
    A pod too thin for a move to mean anything moves nobody, and then there is
    no promotion place to be near and nothing to say about it.
  */
  const moving = movingFrom(standings.length);

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
