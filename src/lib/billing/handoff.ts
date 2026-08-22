import "server-only";

import { canWriteGame } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import type { LabHandoffRow } from "@/lib/supabase/database.types";

/*
  The Upside Lab handoff.

  Section 9 calls this the actual business case for Arena existing: an
  explicit, well-timed moment pointing a consistently good player at the
  real-money product. It is worth more than the subscription and the coins put
  together, and it is also the easiest thing on this whole list to get wrong.

  Three rules keep it honest.

  It is only offered to somebody it is true for. The test is beating the
  market across several finished weeks, not one lucky one, because a single
  good week is noise and telling somebody otherwise is how a paper-money game
  teaches a bad lesson about a real one.

  It is offered rarely and then never again. Twice at most, and a no is
  permanent. A pitch that reappears every week is an advert, and an advert is
  what the free tier promises there is none of.

  It carries no email address in a URL. An opaque token is enough for Lab to
  recognise where somebody came from, and it means a link somebody pastes
  reveals nothing about them.
*/

/** How many finished weeks are needed before this can be true of anybody. */
export const WEEKS_REQUIRED = 3;

/** How many of those must have beaten the market. */
export const WINS_REQUIRED = 2;

/** How many times it may ever be offered to one person. */
export const MAX_TIMES_SHOWN = 2;

/** How long between the two, so it is never twice in a fortnight. */
const DAYS_BETWEEN = 21;

export type Handoff = {
  token: string;
  weeksPlayed: number;
  weeksAhead: number;
};

/**
 * Whether now is the moment, and the token to carry if it is.
 *
 * Returns null far more often than not, which is the point.
 */
export async function considerHandoff(userId: string): Promise<Handoff | null> {
  if (!canWriteGame) return null;

  const admin = createAdminClient();

  const { data: existing } = await admin
    .from("lab_handoffs")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  const record = existing as LabHandoffRow | null;

  if (record) {
    // A no is permanent, and so is a yes: somebody who went does not need
    // telling again.
    if (record.dismissed_at || record.clicked_at) return null;
    if (record.shown_count >= MAX_TIMES_SHOWN) return null;

    if (record.last_shown_at) {
      const since = Date.now() - new Date(record.last_shown_at).getTime();
      if (since < DAYS_BETWEEN * 24 * 60 * 60 * 1000) return null;
    }
  }

  /*
    Several finished weeks, most of them ahead of the market. Measured against
    the market rather than against a positive return, because a week that made
    money in a rising market is not skill and saying it is would be the lie
    this whole product is built to avoid.
  */
  const { data: scored } = await admin
    .from("portfolios")
    .select("benchmark_diff")
    .eq("user_id", userId)
    .not("benchmark_diff", "is", null);

  const results = ((scored ?? []) as { benchmark_diff: string }[]).map((row) =>
    Number(row.benchmark_diff)
  );

  if (results.length < WEEKS_REQUIRED) return null;

  const ahead = results.filter((diff) => diff > 0).length;
  if (ahead < WINS_REQUIRED) return null;

  const { data } = await admin.rpc("record_handoff_shown", { p_user_id: userId });
  const handoff = data as unknown as LabHandoffRow | null;
  if (!handoff) return null;

  return {
    token: handoff.token,
    weeksPlayed: results.length,
    weeksAhead: ahead,
  };
}

export async function recordHandoffOutcome(
  userId: string,
  outcome: "clicked" | "dismissed"
): Promise<void> {
  if (!canWriteGame) return;

  const admin = createAdminClient();
  await admin.rpc("record_handoff_outcome", {
    p_user_id: userId,
    p_outcome: outcome,
  });
}

/*
  Where the link goes.

  Written down rather than configured. It was an environment variable with
  this same value as its fallback, which read like a knob and was not one:
  NEXT_PUBLIC_ values are inlined when the app is built, so changing one costs
  exactly the redeploy that changing this line costs. All it bought was a row
  in a settings table and a line in a setup guide, both of which said to leave
  it alone.

  The token is opaque and per player. It is enough for Lab to recognise where
  somebody arrived from without Arena putting an email address, a name or an
  account id into a URL that gets pasted into a browser bar and a chat window.
*/
const LAB_URL = "https://upsidelab.app";

export function labUrl(token: string): string {
  const url = new URL(LAB_URL);
  url.searchParams.set("via", "arena");
  url.searchParams.set("t", token);
  return url.toString();
}
