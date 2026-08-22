import "server-only";

import { canWriteGame } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import type { WeeklyGoalRow } from "@/lib/supabase/database.types";
import type { GoalKind } from "@/lib/game/goal-kinds";

/*
  Reading and writing what somebody said they would do this week.

  The four choices themselves live in goal-kinds.ts, which is pure, because a
  browser renders the same list this file checks against.
*/

export type DeclaredGoal = {
  userId: string;
  kind: GoalKind;
  label: string;
  /*
    Whether it has been met so far, or null when nothing can be said yet.

    Worked out from the week in progress rather than stored, so it is never a
    second opinion about a result. On Friday the week settles and this settles
    with it.
  */
  met: boolean | null;
};

/** Every goal declared to one league this week. */
export async function getGoals(
  leagueId: string,
  cycleId: string
): Promise<Map<string, WeeklyGoalRow>> {
  if (!canWriteGame) return new Map();

  const admin = createAdminClient();
  const { data } = await admin
    .from("weekly_goals")
    .select("*")
    .eq("league_id", leagueId)
    .eq("cycle_id", cycleId);

  return new Map(
    ((data ?? []) as WeeklyGoalRow[]).map((row) => [row.user_id, row])
  );
}

/**
 * Whether they have said anything to anybody this week.
 *
 * One indexed read across every league they are in, for the first-week list
 * on Home, which needs to know that a goal exists rather than what it is.
 */
export async function hasDeclaredGoal(
  userId: string,
  cycleId: string
): Promise<boolean> {
  if (!canWriteGame) return false;

  const admin = createAdminClient();
  const { data } = await admin
    .from("weekly_goals")
    .select("id")
    .eq("user_id", userId)
    .eq("cycle_id", cycleId)
    .limit(1);

  return (data ?? []).length > 0;
}

export type DeclareOutcome =
  | { ok: true }
  | { ok: false; error: string };

export async function declareGoal(
  userId: string,
  leagueId: string,
  cycleId: string,
  kind: GoalKind
): Promise<DeclareOutcome> {
  if (!canWriteGame) return { ok: false, error: "Not switched on yet." };

  const admin = createAdminClient();
  const { error } = await admin.rpc("declare_goal", {
    p_user_id: userId,
    p_league_id: leagueId,
    p_cycle_id: cycleId,
    p_kind: kind,
  });

  if (error) {
    if (error.message.includes("already declared")) {
      return {
        ok: false,
        error: "You already said what you are doing this week here.",
      };
    }
    if (error.message.includes("not a member")) {
      return { ok: false, error: "You are not in that league." };
    }
    return { ok: false, error: "We could not save that. Try again." };
  }

  return { ok: true };
}

/**
 * Taking it back.
 *
 * Deliberately available, and deliberately not through a function only the
 * server may call: it is the one thing here that can only take something away
 * from the person doing it. Holding somebody to a promise they want out of is
 * a trap, not a mechanic.
 */
export async function withdrawGoal(
  userId: string,
  leagueId: string,
  cycleId: string
): Promise<boolean> {
  if (!canWriteGame) return false;

  const admin = createAdminClient();

  /*
    Whether it actually went is worth returning. A goal is visible to everybody
    in the league, so somebody told it was taken back while it is still on the
    screen beside their name has been told the opposite of what happened.
  */
  const { error } = await admin
    .from("weekly_goals")
    .delete()
    .eq("user_id", userId)
    .eq("league_id", leagueId)
    .eq("cycle_id", cycleId);

  return !error;
}
