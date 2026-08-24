import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { recordError } from "@/lib/errors";

/*
  Where a screen that would not draw says so.

  The boundaries in error.tsx and global-error.tsx wrote to the browser
  console, which is a place exactly one person can read and only with it open.
  This is the other half: the same failure, written where it can be counted.

  Three things keep it from being a hole in the side of the app.

    It is not on the public list, so the proxy answers 401 to anybody without
    a session before this file runs. A signed-out visitor's failure is not
    recorded, which is a real gap and a small one: the signed-out surface is
    one page and the browser suite walks it on every pull request.

    It reads a fixed number of short fields and ignores the rest of the body,
    so the largest thing it can be made to write is a few hundred characters
    against a fingerprint that already exists.

    It records nothing about who. The session is a gate, not a field: the
    id of whoever is signed in is never read, never passed on and never
    stored.
*/

export const maxDuration = 10;

/** Long enough to name a failure, short enough not to be a stack. */
const MAX_MESSAGE = 300;
const MAX_BODY = 4_000;

/*
  How many reports one account may file in a minute.

  A page can fail in a loop, and a person can hold a key down. Neither is
  worth more than a handful of rows, and without a ceiling somebody signed in
  could write an unbounded number of distinct fingerprints, which is the one
  way this endpoint could cost anything. Held in memory rather than in the
  database, because the point is to avoid the write.
*/
const PER_MINUTE = 10;
const MINUTE = 60_000;

const filed = new Map<string, { count: number; since: number }>();

function withinLimit(userId: string, now = Date.now()): boolean {
  const seen = filed.get(userId);

  if (!seen || now - seen.since > MINUTE) {
    filed.set(userId, { count: 1, since: now });

    // The map is bounded by whoever has reported in the last minute, which is
    // nobody on an ordinary day. Swept here rather than on a timer, so an idle
    // process holds nothing.
    if (filed.size > 500) {
      for (const [key, entry] of filed) {
        if (now - entry.since > MINUTE) filed.delete(key);
      }
    }

    return true;
  }

  seen.count += 1;
  return seen.count <= PER_MINUTE;
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // The proxy has usually answered this already. Checked again here because a
  // route that depends on something else having checked is a route that stops
  // being checked the day that something else moves.
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  /*
    The one thing the id of whoever is signed in is used for, and it does not
    leave this function: a key in a counter that is thrown away a minute
    later. It is never passed to recordError and never written down.
  */
  if (!withinLimit(user.id)) {
    return NextResponse.json({ ok: false }, { status: 429 });
  }

  let body: unknown;
  try {
    const text = await request.text();
    if (text.length > MAX_BODY) return NextResponse.json({ ok: false }, { status: 413 });
    body = JSON.parse(text);
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const input = (body ?? {}) as Record<string, unknown>;

  const message = typeof input.message === "string" ? input.message.trim() : "";
  if (!message) return NextResponse.json({ ok: false }, { status: 400 });

  /*
    The route, taken apart and put back together rather than trusted. A path
    is all that is wanted: a query string can carry an invite code or a share
    token, and neither belongs in a log of what broke.
  */
  const at = typeof input.at === "string" ? input.at.split("?")[0].slice(0, 120) : null;
  const digest = typeof input.digest === "string" ? input.digest.slice(0, 64) : null;

  await recordError({
    kind: "client",
    message: message.slice(0, MAX_MESSAGE),
    at,
    digest,
  });

  return NextResponse.json({ ok: true }, { headers: { "cache-control": "no-store" } });
}
