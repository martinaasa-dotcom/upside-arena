import "server-only";

import { cacheLife } from "next/cache";

import { canWriteGame } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ErrorReportRow } from "@/lib/supabase/database.types";

/*
  Writing down what broke.

  A failure used to tell nobody. A screen that would not render logged to the
  browser console, where one person could see it and only with it open, and
  the server's own errors went to the host's log, kept for an hour on the plan
  this runs on. Which means a bug was found when somebody wrote in about it:
  the most expensive way there is, and one that depends on a stranger caring
  enough to write.

  What this is not is a monitoring product. It is a table keyed on what broke
  rather than on when, so a page failing for three hundred people is one row
  with a count of three hundred, and a page in `/metrics` that reads it. The
  useful nine tenths of a subscription, for the price of a migration.

  Nothing here records who. Not a user id, not an address, not a session, not
  a header, not a query string. What broke and where is the whole of what is
  needed to fix it.
*/

export type ErrorKind = "client" | "server";

/** Long enough to identify a failure, short enough not to be a stack. */
const MAX_MESSAGE = 300;

/**
 * The message, as much of it as is useful and none of what is not.
 *
 * A stack trace is deliberately dropped rather than trimmed: it is a map of
 * the source, it is different for every browser, and it would turn one bug
 * into a hundred fingerprints.
 */
export function readMessage(error: unknown): string {
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";

  const first = raw.split("\n")[0]?.trim() ?? "";
  return first.slice(0, MAX_MESSAGE) || "an error with nothing to say";
}

/**
 * Records a failure, and never becomes one itself.
 *
 * Called from catch blocks, so it swallows everything: an error logger that
 * can throw turns one failure into two, and the second one has nowhere to go.
 */
export async function recordError(input: {
  kind: ErrorKind;
  message: string;
  /** The route, without a query string. */
  at?: string | null;
  /** Next's own digest, when the failure has one. */
  digest?: string | null;
}): Promise<void> {
  if (!canWriteGame) return;

  try {
    const admin = createAdminClient();
    await admin.rpc("record_error", {
      p_kind: input.kind,
      p_message: input.message.slice(0, MAX_MESSAGE),
      p_at: input.at ?? null,
      p_digest: input.digest ?? null,
    });
  } catch {
    // Nowhere left to say it. The host's log still has the original.
  }
}

/**
 * The same, for a caught error rather than a message somebody wrote.
 *
 * The one line callers actually want: it reads the message, keeps the console
 * line the host's log is built on, and writes the row.
 */
export async function reportServerError(
  error: unknown,
  at: string
): Promise<void> {
  const message = readMessage(error);
  console.error(`${at}: ${message}`);
  await recordError({ kind: "server", message, at });
}

export type ErrorReport = {
  fingerprint: string;
  kind: ErrorKind;
  message: string;
  at: string | null;
  digest: string | null;
  seen: number;
  firstSeen: string;
  lastSeen: string;
};

/**
 * What broke lately, newest first, for the owner's page.
 *
 * Cached like everything else a room reads, so `/metrics` arrives holding its
 * numbers rather than assembling them in front of whoever opened it. A minute
 * behind is the right amount of behind for a list somebody checks once a day:
 * the row this misses is on the next refresh, and a failure that has happened
 * once has almost certainly happened again by then.
 */
export async function recentErrors(limit = 20): Promise<ErrorReport[]> {
  "use cache";
  cacheLife({ stale: 300, revalidate: 60, expire: 3600 });

  if (!canWriteGame) return [];

  const admin = createAdminClient();
  const { data } = await admin
    .from("error_reports")
    .select("*")
    .order("last_seen", { ascending: false })
    .limit(limit);

  return ((data ?? []) as ErrorReportRow[]).map((row) => ({
    fingerprint: row.fingerprint,
    kind: row.kind,
    message: row.message,
    at: row.at,
    digest: row.digest,
    seen: row.seen,
    firstSeen: row.first_seen,
    lastSeen: row.last_seen,
  }));
}
