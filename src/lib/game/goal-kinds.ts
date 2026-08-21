import type { Standing } from "@/lib/game/leagues";

/*
  What somebody can say they will do this week, in front of their league.

  Section 3 lists public commitment as one of the levers that genuinely works:
  saying it out loud to people who will see whether you did it measurably
  increases the chance you do. It earns nothing and costs nothing, which is
  what keeps it a commitment rather than a competition inside a competition.

  Chosen from this list rather than typed. Free text inside somebody else's
  league is a moderation surface, and a commitment does not need to be in your
  own words to be one.

  Pure, and free of anything server side, because the same four choices are
  rendered in a browser and checked on a server.
*/

export const GOALS = [
  {
    kind: "beat_market" as const,
    label: "Beat the market",
    detail: "Finish the week ahead of where the market finished.",
  },
  {
    kind: "finish_up" as const,
    label: "Finish the week up",
    detail: "End Friday with more than you started Monday with.",
  },
  {
    kind: "top_three" as const,
    label: "Finish top three here",
    detail: "In this league, not overall.",
  },
  {
    kind: "every_day" as const,
    label: "Show up every day",
    detail: "Open Arena on all five trading days. Nothing to do with money.",
  },
];

export type GoalKind = (typeof GOALS)[number]["kind"];

export const GOAL_KINDS = GOALS.map((goal) => goal.kind);

export function isGoalKind(value: string): value is GoalKind {
  return (GOAL_KINDS as string[]).includes(value);
}

export function goalLabel(kind: GoalKind): string {
  return GOALS.find((goal) => goal.kind === kind)?.label ?? "A goal";
}

/** Trading days in a full week, which is what "every day" means. */
const FULL_WEEK = 5;

/** What "top three" means, said once rather than written in the check. */
const TOP_THREE = 3;

/**
 * Whether a goal has been met, as far as the week has gone.
 *
 * Three answers, not two. Null means the week has not decided yet, and it is
 * shown as "still going" rather than as a failure: marking somebody as having
 * missed a goal on Tuesday would be a fabricated near-miss, which section 3
 * rules out as firmly as a fabricated anything else.
 */
export function goalMet(
  kind: GoalKind,
  standing: Standing,
  week: { streakThisWeek: number; tradingDaysSoFar: number }
): boolean | null {
  switch (kind) {
    case "beat_market":
      return standing.versusMarket == null ? null : standing.versusMarket > 0;
    case "finish_up":
      return standing.returnPercent > 0;
    case "top_three":
      return standing.rank <= TOP_THREE;
    case "every_day": {
      if (week.streakThisWeek >= FULL_WEEK) return true;
      /*
        A day already missed cannot be made up, so this one can be settled
        early. Every other case is still open.
      */
      if (week.streakThisWeek < week.tradingDaysSoFar) return false;
      return null;
    }
  }
}
