import { NextResponse, type NextRequest } from "next/server";
import {
  notifyStandingChanges,
  notifyBattleResults,
  notifyBattlesStarted,
  notifyStreaksAtRisk,
  notifyWeekResults,
} from "@/lib/notify/events";
import { recordDailyMarks } from "@/lib/game/marks";
import { applyDueSplits } from "@/lib/game/splits";

/*
  The outside nudge that runs a notification pass.

  Unlike settling, this genuinely does need calling: nobody can be told they
  were passed by a request they did not make. It is still safe to call as often
  as anyone likes, because every message is claimed in the database before it
  is sent, so a second call in the same minute sends nothing twice.

  Each pass decides for itself whether now is the right time. Standings only
  move while the market is open, week results only exist once a week has been
  scored, and a streak reminder only goes out late in the New York day. Calling
  with no job runs all of them and lets each one refuse.

  Recording the day's close rides along here rather than in a job of its own.
  It has to happen once a day after the market shuts and it cannot be caught
  up afterwards, since prices move on, so it belongs on the schedule that is
  already running every hour through the trading day.
*/

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
  /*
    Before everything, including the mark. A company that split this morning
    is held in the wrong number of shares until this runs, and every figure
    after it, the mark, the standings and the message saying somebody was
    passed, would otherwise be built on that number.

    It refuses by itself before the opening bell, because the price a
    fraction of a share is paid out at has to be the post-split one.
  */
  splits: applyDueSplits,
  // Then the mark, so it is written before anything is sent about the day.
  marks: recordDailyMarks,
  standings: notifyStandingChanges,
  week: notifyWeekResults,
  /*
    After the week, because a battle can settle on the same pass and the two
    would otherwise compete for the same daily cap in whichever order the
    object happened to be written. The week everybody plays goes first.
  */
  battles: notifyBattleResults,
  /*
    After the results, and last of the league jobs, because it is the least
    time-critical of them: a battle is announced within a couple of days of
    being made and nothing about it expires that day. A result, by contrast,
    is news for one evening.
  */
  battleStarts: notifyBattlesStarted,
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

  // One after another rather than at once. A pass is not urgent, and several
  // sets of push requests in parallel is a good way to be rate limited.
  for (const name of names) {
    const result = await JOBS[name]();
    jobs[name] = result;
    if ("sent" in result) sent += result.sent;
  }

  return NextResponse.json({ sent, jobs }, { headers: { "cache-control": "no-store" } });
}
