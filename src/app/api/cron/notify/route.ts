import { NextResponse, type NextRequest } from "next/server";
import {
  notifyStandingChanges,
  notifyStreaksAtRisk,
  notifyWeekResults,
} from "@/lib/notify/events";

/*
  The outside nudge that runs a notification pass.

  Unlike settling, this genuinely does need calling: nobody can be told they
  were passed by a request they did not make. It is still safe to call as often
  as anyone likes, because every message is claimed in the database before it
  is sent, so a second call in the same minute sends nothing twice.

  Each pass decides for itself whether now is the right time. Standings only
  move while the market is open, week results only exist once a week has been
  scored, and a streak reminder only goes out late in the New York day. Calling
  with no job runs all three and lets each one refuse.
*/

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorised(request: NextRequest) {
  const secret = process.env.CRON_SECRET;

  // With no secret set the endpoint is closed rather than open. An unset
  // variable must never be the thing that makes something public.
  if (!secret) return false;

  const header = request.headers.get("authorization") ?? "";
  const provided = header.startsWith("Bearer ") ? header.slice(7) : "";

  // Compare every character, so the time taken cannot reveal the secret.
  if (provided.length !== secret.length) return false;
  let diff = 0;
  for (let i = 0; i < secret.length; i++) {
    diff |= provided.charCodeAt(i) ^ secret.charCodeAt(i);
  }
  return diff === 0;
}

const JOBS = {
  standings: notifyStandingChanges,
  week: notifyWeekResults,
  streaks: notifyStreaksAtRisk,
} as const;

type JobName = keyof typeof JOBS;

export async function GET(request: NextRequest) {
  if (!authorised(request)) {
    return NextResponse.json({ error: "Not authorised" }, { status: 401 });
  }

  const requested = request.nextUrl.searchParams.get("job");
  const names = (
    requested && requested in JOBS ? [requested as JobName] : (Object.keys(JOBS) as JobName[])
  );

  const jobs: Record<string, unknown> = {};
  let sent = 0;

  // One after another rather than at once. A pass is not urgent, and three
  // sets of push requests in parallel is a good way to be rate limited.
  for (const name of names) {
    const result = await JOBS[name]();
    jobs[name] = result;
    sent += result.sent;
  }

  return NextResponse.json({ sent, jobs }, { headers: { "cache-control": "no-store" } });
}
