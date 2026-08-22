import "server-only";

import { cacheLife, cacheTag } from "next/cache";

import { canWriteGame, siteUrl } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMarks } from "@/lib/game/marks";
import type { Recap } from "@/lib/share/card";
import type { ShareCardRow } from "@/lib/supabase/database.types";

/*
  Turning a finished week into something a person can post.

  The card is a snapshot, taken once and never refreshed. That is a privacy
  decision before it is anything else: a share link is a public URL that ends
  up in a group chat and stays there, so a card that read live data would keep
  exposing a player's current standing to everyone who ever saw the link, and
  would quietly rewrite what they posted last month. Frozen, it says what it
  said, for ever, and reveals nothing that was not deliberately shared.

  Only a finished week can be shared. A week in progress is a number that will
  be wrong in an hour, and posting one would teach people that Arena's numbers
  do not mean anything.
*/

export type ShareCard = {
  id: string;
  token: string;
  url: string;
  recap: Recap;
  createdAt: string;
  revoked: boolean;
};

function num(value: string | number | null): number | null {
  if (value == null) return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function shareUrl(token: string) {
  return `${siteUrl()}/w/${token}`;
}

function toCard(row: ShareCardRow): ShareCard {
  return {
    id: row.id,
    token: row.token,
    url: shareUrl(row.token),
    createdAt: row.created_at,
    revoked: row.revoked_at != null,
    recap: {
      displayName: row.display_name,
      title: row.title_name,
      monday: row.monday,
      returnPercent: num(row.return_percent) ?? 0,
      benchmarkReturn: num(row.benchmark_return),
      benchmarkDiff: num(row.benchmark_diff),
      league:
        row.league_name && row.league_rank != null && row.league_size != null
          ? { name: row.league_name, rank: row.league_rank, size: row.league_size }
          : null,
      streakDays: row.streak_days,
      marks: Array.isArray(row.marks) ? row.marks.map(Number) : [],
    },
  };
}

/**
 * The most recently scored week for this player, ready to be frozen.
 *
 * Returns null when they have no finished week yet, which is the normal state
 * for anyone in their first few days.
 */
export async function getLatestRecap(userId: string): Promise<
  { recap: Recap; cycleId: string } | null
> {
  if (!canWriteGame) return null;

  const admin = createAdminClient();

  /*
    Their own most recent scored portfolio, rather than the most recent closed
    week. Somebody who did not play last week should be offered the week they
    did play, not an empty card for a week they sat out.
  */
  const { data: portfolios } = await admin
    .from("portfolios")
    .select("id, cycle_id, return_percent, benchmark_diff")
    .eq("user_id", userId)
    .not("return_percent", "is", null)
    .order("updated_at", { ascending: false })
    .limit(1);

  const portfolio = (portfolios ?? [])[0] as
    | {
        id: string;
        cycle_id: string;
        return_percent: string;
        benchmark_diff: string | null;
      }
    | undefined;

  if (!portfolio) return null;

  const [{ data: cycles }, { data: profiles }, { data: streaks }, marks] =
    await Promise.all([
      admin
        .from("weekly_cycles")
        .select("id, monday, benchmark_open, benchmark_close")
        .eq("id", portfolio.cycle_id)
        .maybeSingle(),
      admin
        .from("profiles")
        .select("display_name, equipped_title")
        .eq("id", userId)
        .maybeSingle(),
      admin
        .from("streaks")
        .select("current_streak")
        .eq("user_id", userId)
        .maybeSingle(),
      getMarks(portfolio.id),
    ]);

  const cycle = cycles as {
    id: string;
    monday: string;
    benchmark_open: string | null;
    benchmark_close: string | null;
  } | null;
  if (!cycle) return null;

  const profile = profiles as {
    display_name: string | null;
    equipped_title: string | null;
  } | null;

  const open = num(cycle.benchmark_open);
  const close = num(cycle.benchmark_close);
  const benchmarkReturn =
    open != null && close != null && open > 0 ? ((close - open) / open) * 100 : null;

  /*
    The worn title and the best placing, together.

    Neither wants anything the other produces, and the placing is three round
    trips on its own, so awaiting the title first simply parked the whole
    recap behind a single-row name lookup. This runs on the way into Home.
  */
  const [title, league] = await Promise.all([
    profile?.equipped_title ? titleName(profile.equipped_title) : null,
    bestLeaguePlacing(userId, cycle.id),
  ]);

  return {
    cycleId: cycle.id,
    recap: {
      displayName: profile?.display_name ?? "A player",
      title,
      monday: cycle.monday,
      returnPercent: num(portfolio.return_percent) ?? 0,
      benchmarkReturn,
      benchmarkDiff: num(portfolio.benchmark_diff),
      league,
      streakDays: (streaks as { current_streak: number } | null)?.current_streak ?? 0,
      marks,
    },
  };
}

async function titleName(rewardId: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("rewards")
    .select("name")
    .eq("id", rewardId)
    .maybeSingle();
  return (data as { name: string } | null)?.name ?? null;
}

/**
 * Where they finished, in the league where they did best.
 *
 * Somebody in three leagues has three placings, and the card has room for
 * one. Their best is the one they would choose, and choosing it for them is
 * the difference between a card worth posting and one that is not.
 */
async function bestLeaguePlacing(
  userId: string,
  cycleId: string
): Promise<Recap["league"]> {
  const admin = createAdminClient();

  const { data: memberships } = await admin
    .from("league_members")
    .select("league_id")
    .eq("user_id", userId);

  const leagueIds = ((memberships ?? []) as { league_id: string }[]).map(
    (row) => row.league_id
  );
  if (leagueIds.length === 0) return null;

  const [{ data: leagues }, { data: roster }] = await Promise.all([
    admin.from("leagues").select("id, name").in("id", leagueIds),
    admin.from("league_members").select("league_id, user_id").in("league_id", leagueIds),
  ]);

  const members = (roster ?? []) as { league_id: string; user_id: string }[];
  const everyone = [...new Set(members.map((row) => row.user_id))];

  // The scored results for that week, for everyone in any of their leagues.
  const { data: scored } = await admin
    .from("portfolios")
    .select("user_id, return_percent")
    .eq("cycle_id", cycleId)
    .in("user_id", everyone)
    .not("return_percent", "is", null);

  const returns = new Map(
    ((scored ?? []) as { user_id: string; return_percent: string }[]).map((row) => [
      row.user_id,
      Number(row.return_percent),
    ])
  );

  const mine = returns.get(userId);
  if (mine == null) return null;

  const names = new Map(
    ((leagues ?? []) as { id: string; name: string }[]).map((row) => [row.id, row.name])
  );

  let best: Recap["league"] = null;

  for (const leagueId of leagueIds) {
    const inLeague = members
      .filter((row) => row.league_id === leagueId)
      .map((row) => returns.get(row.user_id))
      .filter((value): value is number => value != null);

    // A league of one has no placing worth showing.
    if (inLeague.length < 2) continue;

    const rank = inLeague.filter((value) => value > mine).length + 1;
    const placing = {
      name: names.get(leagueId) ?? "a league",
      rank,
      size: inLeague.length,
    };

    // Better means further up. A tie goes to the bigger league, because
    // second of twelve says more than second of two.
    if (!best || rank < best.rank || (rank === best.rank && placing.size > best.size)) {
      best = placing;
    }
  }

  return best;
}

export type ShareOutcome =
  | { ok: true; card: ShareCard }
  /** Nothing has been scored for them yet. Normal in a first week. */
  | { ok: false; reason: "no_finished_week" }
  | { ok: false; reason: "failed"; detail?: string };

/**
 * Freezes the player's latest finished week into a shareable card.
 *
 * The two ways this can fail are told apart on purpose. "You have no finished
 * week yet" and "something broke" want completely different words in front of
 * a player, and collapsing them means the second one is reported as the first
 * and never gets looked at.
 */
export async function shareLatestWeek(userId: string): Promise<ShareOutcome> {
  if (!canWriteGame) return { ok: false, reason: "failed", detail: "not configured" };

  const latest = await getLatestRecap(userId);
  if (!latest) return { ok: false, reason: "no_finished_week" };

  const { recap, cycleId } = latest;
  const admin = createAdminClient();

  const { data, error } = await admin.rpc("create_share_card", {
    p_user_id: userId,
    p_cycle_id: cycleId,
    p_monday: recap.monday,
    p_display_name: recap.displayName,
    p_title_name: recap.title,
    p_return_percent: recap.returnPercent,
    p_benchmark_return: recap.benchmarkReturn,
    p_benchmark_diff: recap.benchmarkDiff,
    p_league_name: recap.league?.name ?? null,
    p_league_rank: recap.league?.rank ?? null,
    p_league_size: recap.league?.size ?? null,
    p_streak_days: recap.streakDays,
    p_marks: recap.marks,
  });

  if (error || !data) {
    return { ok: false, reason: "failed", detail: error?.message };
  }

  return { ok: true, card: toCard(data as unknown as ShareCardRow) };
}

/** The card behind a public link, or null when there is nothing to show. */
/** The tag a card's cached copy is filed under, so revoking can drop it. */
export function shareCardTag(token: string) {
  return `share-card:${token}`;
}

/*
  Cached until the card is taken down.

  A settled week is frozen: the numbers were true on a Friday and will not
  move again. The link, meanwhile, is the one thing here built to travel --
  posted into a group chat and then fetched once per person who opens it, once
  per app that unfurls it, and twice per view besides, because the page asks
  for the card once for its metadata and again to draw itself.

  So it is cached for as long as it can be, and revoking is what ends that
  rather than a timer. unshareCard calls updateTag on the tag below, which
  expires this immediately: the next request reads the row again, finds
  revoked_at set, and the page says the link no longer works. There is no
  window in which a revoked card is still served, which is the property that
  made a plain time-based cache the wrong answer here.
*/
export async function getSharedCard(token: string): Promise<ShareCard | null> {
  "use cache";
  cacheLife("max");
  cacheTag(shareCardTag(token));

  if (!canWriteGame || !token) return null;

  const admin = createAdminClient();
  const { data } = await admin
    .from("share_cards")
    .select("*")
    .eq("token", token)
    .maybeSingle();

  const row = data as ShareCardRow | null;

  // A revoked card is gone as far as anyone holding the link is concerned.
  if (!row || row.revoked_at != null) return null;

  return toCard(row);
}

/** Every card this player has made, newest first. */
export async function getMyCards(userId: string): Promise<ShareCard[]> {
  if (!canWriteGame) return [];

  const admin = createAdminClient();
  const { data } = await admin
    .from("share_cards")
    .select("*")
    .eq("user_id", userId)
    .is("revoked_at", null)
    .order("monday", { ascending: false });

  return ((data ?? []) as ShareCardRow[]).map(toCard);
}

/**
 * Takes a card down, and says which link it was.
 *
 * The token is read before the revoke rather than after, because the caller
 * needs it to expire the cached copy of a page that must stop being served.
 * One extra read, on something a player does approximately never.
 */
export async function revokeCard(
  userId: string,
  cardId: string
): Promise<{ ok: boolean; token: string | null }> {
  if (!canWriteGame) return { ok: false, token: null };

  const admin = createAdminClient();

  const { data: row } = await admin
    .from("share_cards")
    .select("token")
    .eq("id", cardId)
    .eq("user_id", userId)
    .maybeSingle();

  const { data } = await admin.rpc("revoke_share_card", {
    p_user_id: userId,
    p_card_id: cardId,
  });

  return { ok: data === true, token: (row as { token: string } | null)?.token ?? null };
}
