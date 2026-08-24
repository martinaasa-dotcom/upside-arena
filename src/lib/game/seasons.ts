import "server-only";

import { canWriteGame } from "@/lib/env";
import { MIN_WEEKS_TO_RANK } from "@/lib/game/season-rules";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SeasonRow, SeasonStandingRow } from "@/lib/supabase/database.types";
import { playerCache } from "@/lib/game/cache";

/*
  The season, read.

  Nothing here computes a result. Every number below was settled on some
  Friday and added up by the database at the time; this file only fetches it
  and puts names to the rows. That is deliberate: a season standing that was
  worked out live could disagree with the week it came from, and two versions
  of the same result is the fastest way to lose somebody's trust in both.
*/

/*
  Re-exported rather than defined here, so a client component can name a
  threshold without pulling this file's admin client into the browser bundle.
  See season-rules.ts.
*/
export { MIN_WEEKS_TO_RANK, WEEKS_FOR_REGULAR } from "@/lib/game/season-rules";

export type SeasonStanding = {
  userId: string;
  displayName: string;
  handle: string | null;
  avatarUrl: string | null;
  /** Their place, once the season has been ranked. Null while it runs. */
  rank: number | null;
  /** Where they stand right now, whether or not the season has finished. */
  position: number;
  weeksPlayed: number;
  weeksAhead: number;
  /** Points ahead of the market, per week played. */
  averageVersusMarket: number;
  averageReturnPercent: number;
  bestWeekReturn: number | null;
  isYou: boolean;
  /** False until they have played enough of the quarter to be ranked. */
  ranked: boolean;
};

export type Season = {
  id: string;
  name: string;
  startsOn: string;
  endsOn: string;
  status: "open" | "closed";
};

export type SeasonView = {
  season: Season;
  standings: SeasonStanding[];
  /** The viewer's own row, which may be below the part of the table shown. */
  you: SeasonStanding | null;
  /** How many weeks of this season have been settled. */
  weeksSettled: number;
  /** And how many more they need before they are ranked. Zero once they are. */
  weeksUntilRanked: number;
};

function num(value: string | number | null | undefined): number {
  if (value == null) return 0;
  return typeof value === "number" ? value : Number(value);
}

function toSeason(row: SeasonRow): Season {
  return {
    id: row.id,
    name: row.name,
    startsOn: row.starts_on,
    endsOn: row.ends_on,
    status: row.status,
  };
}

/** The season a date falls in, if one has been started for it. */
export async function getCurrentSeason(): Promise<Season | null> {
  if (!canWriteGame) return null;

  const admin = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data } = await admin
    .from("seasons")
    .select("*")
    .lte("starts_on", today)
    .gte("ends_on", today)
    .maybeSingle();

  return data ? toSeason(data as SeasonRow) : null;
}

/** Every season that has had a week settled in it, newest first. */
export async function getSeasons(): Promise<Season[]> {
  if (!canWriteGame) return [];

  const admin = createAdminClient();
  const { data } = await admin
    .from("seasons")
    .select("*")
    .order("starts_on", { ascending: false });

  return ((data ?? []) as SeasonRow[]).map(toSeason);
}

/**
 * The table for one season.
 *
 * Ordered on points ahead of the market per week rather than on total return,
 * because a season is thirteen weeks of an identical start each: adding up
 * returns would rank whoever showed up most, which is a different game.
 */
export async function getSeasonView(
  userId: string,
  seasonId?: string,
  limit = 50
): Promise<SeasonView | null> {
  "use cache";
  playerCache(userId);

  if (!canWriteGame) return null;

  const admin = createAdminClient();

  const { data: seasonRow } = seasonId
    ? await admin.from("seasons").select("*").eq("id", seasonId).maybeSingle()
    : await admin
        .from("seasons")
        .select("*")
        .order("starts_on", { ascending: false })
        .limit(1)
        .maybeSingle();

  if (!seasonRow) return null;
  const season = toSeason(seasonRow as SeasonRow);

  /*
    The table, ranked and cut to a page by the database.

    This used to ask for every season_results row in the quarter, then every
    profile behind them, sort the lot here and keep the first fifty. That is
    the shape that stops working first: a season is three months of an open
    game, and the page it is on is the one people open to see whether they are
    climbing. season_standings (0028) orders it once over an index, hands back
    the page and the caller's own row wherever it is, and orders it in exactly
    the way close_season awards the final places, so the table cannot read one
    way all quarter and hand out its medals in another.
  */
  const [{ data: results }, { count: weeksSettled }] = await Promise.all([
    admin.rpc("season_standings", {
      p_season_id: season.id,
      p_user_id: userId,
      p_min_weeks: MIN_WEEKS_TO_RANK,
      p_limit: limit,
    }),
    admin
      .from("weekly_cycles")
      .select("id", { count: "exact", head: true })
      .eq("season_id", season.id),
  ]);

  const rows = (results ?? []) as SeasonStandingRow[];

  const profileIds = rows.map((row) => row.user_id);
  const { data: profiles } = profileIds.length
    ? await admin
        .from("profiles")
        .select("id, display_name, handle, avatar_url")
        .in("id", profileIds)
    : { data: [] as never[] };

  const profileById = new Map(
    (
      (profiles ?? []) as {
        id: string;
        display_name: string | null;
        handle: string | null;
        avatar_url: string | null;
      }[]
    ).map((p) => [p.id, p])
  );

  const standings: SeasonStanding[] = rows.map((row) => {
    const profile = profileById.get(row.user_id);
    const weeks = row.weeks_played;

    return {
      userId: row.user_id,
      displayName: profile?.display_name ?? "Player",
      handle: profile?.handle ?? null,
      avatarUrl: profile?.avatar_url ?? null,
      rank: row.final_rank,
      weeksPlayed: weeks,
      weeksAhead: row.weeks_ahead,
      averageVersusMarket: weeks > 0 ? num(row.sum_benchmark_diff) / weeks : 0,
      averageReturnPercent: weeks > 0 ? num(row.sum_return_percent) / weeks : 0,
      bestWeekReturn:
        row.best_week_return == null ? null : num(row.best_week_return),
      isYou: row.user_id === userId,
      ranked: row.ranked,
      position: row.place,
    };
  });

  const you = standings.find((row) => row.isYou) ?? null;

  return {
    season,
    /*
      The page, without the caller's own row when it came back from outside
      it. They are shown where they stand separately, above the table.
    */
    standings: standings.filter((row) => row.position <= limit),
    you,
    weeksSettled: weeksSettled ?? 0,
    weeksUntilRanked: you
      ? Math.max(0, MIN_WEEKS_TO_RANK - you.weeksPlayed)
      : MIN_WEEKS_TO_RANK,
  };
}

/** Every finished season a player was ranked in, for their profile. */
export async function getSeasonHistory(
  userId: string
): Promise<{ season: Season; rank: number | null; weeksPlayed: number }[]> {
  "use cache";
  playerCache(userId);

  if (!canWriteGame) return [];

  const admin = createAdminClient();

  const { data } = await admin
    .from("season_results")
    .select("season_id, final_rank, weeks_played")
    .eq("user_id", userId);

  const rows = (data ?? []) as {
    season_id: string;
    final_rank: number | null;
    weeks_played: number;
  }[];
  if (rows.length === 0) return [];

  const { data: seasons } = await admin
    .from("seasons")
    .select("*")
    .in("id", rows.map((row) => row.season_id))
    .order("starts_on", { ascending: false });

  const resultBySeason = new Map(rows.map((row) => [row.season_id, row]));

  return ((seasons ?? []) as SeasonRow[]).flatMap((row) => {
    const result = resultBySeason.get(row.id);
    if (!result) return [];
    return [
      {
        season: toSeason(row),
        rank: result.final_rank,
        weeksPlayed: result.weeks_played,
      },
    ];
  });
}
