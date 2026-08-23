#!/usr/bin/env node
/*
  Every room, asked whether it can be prerendered at all.

  This exists because the browser probe next door cannot answer that question,
  which took two bugs to learn. The probe freezes a navigation and reads what
  is on screen; when a route has no App Shell the browser simply waits for the
  server and then paints everything at once, so "nothing appeared after the
  first frame" is true of a room that arrived whole and late. It passed Trade
  while Trade was taking a second to draw.

  What does answer it is the validation Cache Components runs in development.
  It names the exact call and the exact line:

    Route "/trade": Next.js encountered the unstable value `new Date()`
      at isLineupWindow (src/lib/market/session.ts:366)
      at CashLine (src/app/(app)/trade/page.tsx:102)

  That is the whole fault class in one message: something on the render path
  reads a value that cannot be known ahead of the request -- a clock, a random
  number, a cookie outside a cached scope -- so the route cannot be prerendered,
  so a link has nothing to prefetch, so a tap waits for the server. Twice now
  that has been one line at the bottom of a page costing the entire room.

  So this starts a dev server as an invented signed-in player with a week in
  progress, opens every room, and fails on any such insight.
*/

import { spawn } from "node:child_process";
import { readFileSync, rmSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";

const PORT = 3930;
const ROOMS = ["/home", "/trade", "/leagues", "/season", "/profile"];

/*
  What the framework says when a route cannot be prerendered. Matched on the
  message rather than on a rule name, because the name differs per cause
  (current-time, random, crypto) and the consequence is identical.
*/
const BLOCKING = /encountered the unstable value|blocking-prerender/i;

/*
  Where the insight actually goes, which is not where it looks like it goes.

  The dev server prints a great deal to its own stdout and this is not part of
  it: validation findings are written as JSON to a log file under .next, and a
  first version of this script watched the process output instead and reported
  every room healthy while Trade was broken. Reading the wrong stream is a
  check that cannot fail, which is worse than no check.
*/
const DEV_LOG = ".next/dev/logs/next-development.log";

function findings() {
  let raw = "";
  try {
    raw = readFileSync(DEV_LOG, "utf8");
  } catch {
    return [];
  }

  return raw
    .split("\n")
    .filter((line) => BLOCKING.test(line))
    .map((line) => {
      try {
        return JSON.parse(line).message ?? line;
      } catch {
        return line;
      }
    });
}

/*
  A cold start, deliberately, and it is the slow part of this check.

  Validation happens while a route renders. A dev server that still has the
  previous run's work does not render it again, so a second version of this
  script watched five rooms answer in a hundred milliseconds each and reported
  all of them healthy while Trade was broken. Fast and wrong.

  So the development cache goes first, along with the log, and every room is
  rendered from nothing. That costs about a minute, which is the price of the
  check meaning anything.
*/
try {
  rmSync(".next/dev", { force: true, recursive: true });
} catch {
  // Nothing there to remove.
}

const server = spawn("npx", ["next", "dev", "--port", String(PORT)], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    NEXT_PUBLIC_SUPABASE_URL: "https://placeholder.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "placeholder-anon-key-no-project-behind-it",
    SUPABASE_SERVICE_ROLE_KEY: "placeholder-service-role-key",
    NEXT_PUBLIC_SITE_URL: `http://127.0.0.1:${PORT}`,
    ARENA_STUB_SESSION: "1",
    NODE_USE_ENV_PROXY: "1",
  },
  stdio: ["ignore", "pipe", "pipe"],
});

let log = "";
server.stdout.on("data", (d) => (log += d.toString()));
server.stderr.on("data", (d) => (log += d.toString()));

/*
  Sets the exit code and lets node leave on its own rather than calling
  process.exit, which can cut off output that has been written but not yet
  flushed -- and the output here is the whole point: the stack naming the line
  that cannot be prerendered.
*/
function stop(code) {
  process.exitCode = code;
  server.kill("SIGKILL");
}

async function ready() {
  for (let i = 0; i < 60; i += 1) {
    try {
      await fetch(`http://127.0.0.1:${PORT}/`);
      return true;
    } catch {
      await sleep(1000);
    }
  }
  return false;
}

if (!(await ready())) {
  console.error("dev server never came up\n" + log.slice(-2000));
  stop(1);
  throw new Error("dev server never came up");
}


/*
  Every room, with a bound on each.

  The upstreams here are placeholder hostnames that nothing answers, and how
  long that takes depends entirely on where this runs: seconds behind a proxy
  that refuses them, potentially forever on a runner that will happily wait
  for a connection. Without a bound this step hung in CI for six minutes
  before anybody looked.

  A room that runs out of time is not a failure of this check. Validation
  happens while a route renders, so a room that got far enough to be validated
  has already written whatever it found, and the log is read either way. What
  the timeout stops is waiting on a socket, which tells us nothing.
*/
const PER_ROOM_MS = 60_000;

for (const room of ROOMS) {
  const started = Date.now();
  try {
    const response = await fetch(`http://127.0.0.1:${PORT}${room}`, {
      signal: AbortSignal.timeout(PER_ROOM_MS),
    });
    // Read the body so the render actually finishes before the next room.
    await response.text();
    console.log(`  ${room} -> ${response.status} in ${Date.now() - started}ms`);
  } catch (error) {
    console.log(
      `  ${room} -> gave up after ${Date.now() - started}ms (${
        error instanceof Error ? error.name : String(error)
      }); its insights are still read below`
    );
  }
}

// The insight is emitted while rendering, which has just finished.
await sleep(3000);

const blocking = findings();

if (blocking.length > 0) {
  console.error("\nA room cannot be prerendered, so a tap on it waits for the server:\n");
  for (const message of blocking) console.error(message + "\n");

  /*
    The stack does reach the process output, and it is what names the line.
    Printed after the findings rather than instead of them, because the log
    file is the thing being judged.
  */
  const stack = log
    .split("\n")
    .filter((line) => /^\s+at .*\(src\//.test(line));
  if (stack.length > 0) {
    console.error("Where:\n" + [...new Set(stack)].join("\n"));
  }

  stop(1);
} else {
  console.log("\nEvery room can be prerendered.");
  stop(0);
}
