import { NextResponse } from "next/server";
import { canWriteGame } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { getQuote } from "@/lib/market/quotes";
import { BENCHMARK_SYMBOL } from "@/lib/game";
import { hoursSinceContestEnd, nyDate } from "@/lib/market/session";
import { cycleFriday } from "@/lib/game/settle";
import type { WeeklyCycleRow } from "@/lib/supabase/database.types";

/*
  Whether Arena is actually working, in one request.

  Not a page that returns 200 because the server is up. A Next.js app answers
  that while the database is unreachable and every room is empty, which is the
  outage a player would notice and the one an uptime check would sleep
  through. So this asks the three questions whose answers are the app:

    Can the game be read and written at all?
    Are there prices?
    Has a finished week been scored?

  The third one is the reason this exists. Settlement is the failure that is
  invisible from outside: every page renders, nothing errors, and a week
  quietly never ends. It stalled for exactly that reason until 0026, and a
  check that would have caught it belongs here rather than in somebody's
  memory.

  Deliberately public and deliberately dull. It is a handful of words and
  booleans, no counts, no names, no versions and no configuration, so pointing
  a scheduled ping at it gives away nothing that a stranger could use. What it
  costs is one indexed query and one cached quote, which is why it may be
  called every few minutes without being a load of its own.
*/

/*
  No route segment config beyond the timeout: this build runs with cache
  components on, which refuses `dynamic` outright. Nothing here is cached
  anyway, since every answer comes from a live query and the response says
  no-store.
*/
export const maxDuration = 15;

/**
 * How long a finished week may go unscored before this says so.
 *
 * Twelve hours past the close, which is comfortably past the six that
 * settlement itself waits before scoring around a company it cannot price. A
 * week still due after that is stuck rather than patient.
 */
const SETTLEMENT_ALARM_HOURS = 12;

/**
 * How long an answer is reused.
 *
 * This is open to anybody, and every answer costs an indexed query, a second
 * one and a quote. Twenty seconds is shorter than any sensible ping interval
 * and long enough that pointing a thousand requests a second at it costs the
 * database nothing at all. An uptime check reads a status code, and a status
 * code twenty seconds old is the same status code.
 */
const ANSWER_FOR_MS = 20_000;

let lastAnswer: { at: number; ok: boolean; body: Health } | null = null;

type Check = { ok: boolean; detail?: string };
type Health = { ok: boolean; checks: Record<string, Check> };

async function database(): Promise<Check> {
  if (!canWriteGame) return { ok: false, detail: "not configured" };

  try {
    const admin = createAdminClient();
    const { error } = await admin
      .from("weekly_cycles")
      .select("id", { head: true, count: "exact" })
      .limit(1);

    return error ? { ok: false, detail: "unreachable" } : { ok: true };
  } catch {
    return { ok: false, detail: "unreachable" };
  }
}

async function prices(): Promise<Check> {
  try {
    const quote = await getQuote(BENCHMARK_SYMBOL);
    if (!quote) return { ok: false, detail: "no benchmark price" };
    // A cached price served after a failed refresh is a degraded answer, not
    // a broken one. Said out loud rather than folded into a pass.
    return quote.stale ? { ok: true, detail: "serving cached prices" } : { ok: true };
  } catch {
    return { ok: false, detail: "no benchmark price" };
  }
}

async function settlement(): Promise<Check> {
  if (!canWriteGame) return { ok: false, detail: "not configured" };

  try {
    const admin = createAdminClient();
    const { data } = await admin.rpc("due_cycles", { p_today: nyDate() });
    const due = (Array.isArray(data) ? data : []) as WeeklyCycleRow[];

    if (due.length === 0) return { ok: true };

    /*
      A week is allowed to be due. It is settled by the first request that
      notices, which may be minutes away on a quiet Friday evening, and that
      is working as intended. What is not allowed is a week that has been due
      since yesterday.
    */
    const stuck = due.filter(
      (cycle) =>
        hoursSinceContestEnd(cycle.ends_on ?? cycleFriday(cycle.monday)) >
        SETTLEMENT_ALARM_HOURS
    );

    return stuck.length === 0
      ? { ok: true, detail: "a week is due" }
      : { ok: false, detail: `${stuck.length} unscored since yesterday` };
  } catch {
    return { ok: false, detail: "cannot tell" };
  }
}

function answer(body: Health, ok: boolean) {
  return NextResponse.json(body, {
    // 503 rather than 200 with a sad word in it, so a ping that reads
    // nothing but the status code still notices.
    status: ok ? 200 : 503,
    headers: { "cache-control": "no-store" },
  });
}

export async function GET() {
  const held = lastAnswer;
  if (held && Date.now() - held.at < ANSWER_FOR_MS) {
    return answer(held.body, held.ok);
  }

  const [db, price, settle] = await Promise.all([database(), prices(), settlement()]);

  const checks = { database: db, prices: price, settlement: settle };
  const ok = Object.values(checks).every((check) => check.ok);

  lastAnswer = { at: Date.now(), ok, body: { ok, checks } };

  return answer({ ok, checks }, ok);
}
