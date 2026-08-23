import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/*
  A room may not need the server once you have tapped it.

  This is the rule the last three attempts at "make it faster" kept missing,
  each in a different place. The rooms were rewritten to paint a frame
  instantly and every figure still arrived afterwards, one region at a time,
  because every read behind them went to the database or to Yahoo at the
  moment of the tap. Removing round trips made each of those arrivals quicker
  and did not change what it looked like: a page assembling itself in front of
  somebody.

  What changes it is caching, and specifically caching with a long enough
  stale time that the value is carried in the App Shell -- the thing a link
  prefetches. Then the room arrives holding its numbers and there is nothing
  left to stream.

  The rule that produces that is simple and absolute, and it is exactly the
  kind that rots: every function a room awaits while rendering must be cached.
  One uncached read is one region that goes back to streaming, and it looks
  like a bug in the room rather than in the read.

  So this walks each room, collects what it awaits, follows each name to where
  it is defined, and insists on a cache directive there.
*/

const ROOT = path.join(__dirname, "..", "..");
const ROOMS_DIR = path.join(ROOT, "src", "app", "(app)");

/*
  Names a room may await without a cache.

  Every entry is a reason, not a permission. Adding one is a decision about
  what a player sees, so it does not go in without saying which.
*/
const UNCACHED_ON_PURPOSE: Record<string, string> = {
  // A write. A prefetch happens because a link is on screen, so crediting a
  // visit from inside one would count days nobody opened. It renders a card
  // that is already drawn from a cached read, so nothing waits on it.
  recordVisit: "a write, and a prefetch must not count a visit",
};

/** Every routable segment under the signed-in layout. */
function rooms(dir: string, prefix: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const here = path.join(dir, entry.name);
    if (existsSync(path.join(here, "page.tsx"))) found.push(`${prefix}/${entry.name}`);
    found.push(...rooms(here, `${prefix}/${entry.name}`));
  }
  return found;
}

/** Where an identifier imported from "@/lib/..." actually lives. */
function sourceOf(source: string, name: string): string | null {
  const importing = new RegExp(
    `import\\s*\\{([^}]*)\\}\\s*from\\s*"(@/lib/[^"]+)"`,
    "g"
  );

  for (const match of source.matchAll(importing)) {
    const names = match[1].split(",").map((n) => n.trim().split(/\s+as\s+/)[0].trim());
    if (!names.includes(name)) continue;

    const file = path.join(ROOT, "src", match[2].slice("@/".length) + ".ts");
    if (existsSync(file)) return readFileSync(file, "utf8");
  }
  return null;
}

/** The body of a named function, up to the next top-level declaration. */
function bodyOf(source: string, name: string): string | null {
  const declaration = new RegExp(
    `(?:export )?(?:async function ${name}\\b|const ${name} = )`
  );
  const at = source.search(declaration);
  if (at < 0) return null;

  const rest = source.slice(at + 1);
  const next = rest.search(
    /\n(?:export )?(?:async function|const|function|type) /
  );
  return next < 0 ? rest : rest.slice(0, next);
}

/*
  Anchored to the start of a line, and deliberately so.

  A plain substring check was the first version, and commenting a directive
  out left the substring behind: `// "use cache";` still contains it, so the
  check went green on a function whose cache had just been deleted. It was
  found by removing one and watching nothing happen, which is the only way
  this kind of check ever gets found out.
*/
const DIRECTIVE = /^[ \t]*"use cache(?:: (?:private|remote))?";$/m;

function isCached(body: string) {
  return DIRECTIVE.test(body);
}

/*
  Wrappers whose cache lives one name away, and the name it lives at.

  Written out rather than followed automatically, because the automatic
  version does not work. Following every call a function makes and accepting
  any cached one among them passes whenever anything in the same file is
  cached -- which is nearly always, and which this check was written on top of
  until deleting a directive failed to fail it.

  So delegation is declared. There is one, and if a second appears it is worth
  a line here and a moment's thought about whether the wrapper should exist.
*/
const DELEGATES_TO: Record<string, string> = {
  // A React cache() wrapper so several components streaming at once share one
  // call. The directive is on the function it wraps, which is where the
  // cookie is read -- and reading the cookie inside the cache rather than
  // outside it is the difference between a room that arrives whole and one
  // that arrives in pieces. tests/instant watches that happen.
  getSession: "readSession",

  // A Map does not survive a cache -- what comes back is what could be
  // serialised -- so these cache the entries and build the Map on the way
  // out. A Map that arrived empty would show a league where nobody had
  // declared a goal or held a streak, which reads as truth rather than as a
  // bug, so the wrapper is the point rather than an accident.
  getGoals: "goalEntries",
  getWeekStreaks: "weekStreakEntries",
};

function cached(source: string, name: string): boolean {
  const body = bodyOf(source, name);
  if (!body) return true; // Not defined here; nothing to judge.
  if (isCached(body)) return true;

  const helper = DELEGATES_TO[name];
  if (!helper) return false;

  const inner = bodyOf(source, helper);
  return Boolean(inner && isCached(inner));
}

describe("every room arrives with its numbers", () => {
  const found = rooms(ROOMS_DIR, "");

  it("finds the rooms, so an empty pass cannot look like a pass", () => {
    expect(found.length).toBeGreaterThan(4);
  });

  it.each(found)("%s awaits nothing uncached", (route) => {
    const page = readFileSync(
      path.join(ROOMS_DIR, ...route.slice(1).split("/"), "page.tsx"),
      "utf8"
    );

    /*
      What the page renders from: anything awaited directly, and anything
      listed inside a Promise.all, which is how the wider rooms ask for six
      things at once.
    */
    const awaited = new Set<string>();
    for (const m of page.matchAll(/await\s+([a-z][A-Za-z0-9]*)\s*\(/g)) {
      awaited.add(m[1]);
    }
    for (const wave of page.matchAll(/Promise\.all\(\[([\s\S]*?)\]\)/g)) {
      for (const m of wave[1].matchAll(/([a-z][A-Za-z0-9]*)\s*\(/g)) {
        awaited.add(m[1]);
      }
    }

    expect(awaited.size, `${route} awaits nothing at all, which cannot be right`)
      .toBeGreaterThan(0);

    for (const name of awaited) {
      if (name in UNCACHED_ON_PURPOSE) continue;

      const source = sourceOf(page, name);
      // Defined in the page itself, or not from lib: it is a local composer,
      // and what it awaits is checked by this same rule.
      if (!source) continue;

      expect(
        cached(source, name),
        `${route} awaits ${name}, which is not cached, so that region streams in after the tap`
      ).toBe(true);
    }
  });
});
