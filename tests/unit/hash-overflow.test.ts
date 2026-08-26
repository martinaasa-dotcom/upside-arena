/*
  `abs(hashtext(...))` is int32 arithmetic, and this repository has now been
  bitten by it twice.

  `hashtext` returns `integer`. Two things follow, and both were shipped.

  ADDING ANYTHING TO IT CAN OVERFLOW. `abs()` of a hash lands anywhere in
  [0, 2147483647], so `abs(hashtext(x)) + n` raises `integer out of range`
  whenever the hash comes back within n of the top. `supabase/scale/seed.sql`
  did that three times, with n up to 685, over 24,000 rows whose ids are
  `gen_random_uuid()`. That is roughly a 1 in 130 chance per run of the scale
  rehearsal dying in the seed, before `measure.sql` measured a single query.
  It reddened pull requests that had not been near the file, and a re-run
  always cleared it, which is how a real bug gets filed as a flake.

  AND `abs()` HAS NO ANSWER FOR INT_MIN. `streak_bonus_amount` (migration
  0012) had no addition in it and was still wrong for exactly one hash value
  in 4.29 billion. That one is not worth counting on its own; what makes it
  worth a migration is that the function is `immutable` and deterministic by
  design, so the single (player, milestone) pair that landed on it would have
  failed on every attempt for ever, with nothing in the error naming a
  milestone. Migration 0032 replaces it.

  The fix in both places is one cast: do the arithmetic in 64 bits, where
  neither is possible. `% 40`, `% 20000` and `% 5` return the same
  non-negative values on a bigint, so nothing anybody was paid or seeded
  changes.

  Read off the source, because the failure is a value that almost never comes
  up and a test that waited for it would pass for years first.
*/
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = "supabase";

/*
  Applied history that a later migration has already superseded.

  0012 is what really ran against production, so it is not edited; 0032
  redefines the function on top of it. This list is an exception list, never a
  parking space: the check below fails if an entry no longer names a file that
  still carries an uncast use, so a fixed file cannot quietly stay on it.
*/
const ALLOWED: Record<string, string> = {
  "supabase/migrations/0012_streak_bonuses.sql":
    "applied history, superseded by 0032",
};

function sqlFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory()
      ? sqlFiles(path)
      : path.endsWith(".sql")
        ? [path]
        : [];
  });
}

/* Prose names the very thing it is warning about, so the notes come out. */
function code(sql: string): string {
  return sql
    .split("\n")
    .map((line) => {
      const cut = line.indexOf("--");
      return cut === -1 ? line : line.slice(0, cut);
    })
    .join("\n");
}

/**
 * Every `abs(hashtext(` in one file whose `hashtext(...)` is not immediately
 * cast to bigint. Parens are matched rather than pattern-matched, because the
 * argument is an expression and can carry its own.
 */
function uncastUses(sql: string): string[] {
  const found: string[] = [];
  const needle = "abs(hashtext(";
  for (let at = sql.indexOf(needle); at !== -1; at = sql.indexOf(needle, at + 1)) {
    let depth = 0;
    let i = at + needle.length - 1;
    for (; i < sql.length; i += 1) {
      if (sql[i] === "(") depth += 1;
      else if (sql[i] === ")") {
        depth -= 1;
        if (depth === 0) break;
      }
    }
    if (!sql.slice(i + 1).startsWith("::bigint")) {
      found.push(sql.slice(at, i + 1));
    }
  }
  return found;
}

const FILES = sqlFiles(ROOT);

describe("a hash is never added to in 32 bits", () => {
  it("finds the SQL to check at all", () => {
    expect(FILES.length).toBeGreaterThan(10);
  });

  for (const file of FILES) {
    const uses = uncastUses(code(readFileSync(file, "utf8")));
    if (!uses.length) continue;

    it(`${file} casts every hash to bigint`, () => {
      expect(
        ALLOWED[file],
        `${file} has ${uses.length} use(s) of abs(hashtext(...)) with no ` +
          `::bigint: ${uses.join(", ")}. Add the cast rather than an exception.`
      ).toBeTruthy();
    });
  }

  it("keeps the exception list honest", () => {
    for (const file of Object.keys(ALLOWED)) {
      expect(FILES, `${file} is on the exception list and does not exist`).toContain(file);
      expect(
        uncastUses(code(readFileSync(file, "utf8"))).length,
        `${file} no longer has an uncast hash, so it does not need an exception`
      ).toBeGreaterThan(0);
    }
  });

  it("has the migration the one exception is excused by", () => {
    const superseding = FILES.find((f) => f.includes("0032_"));
    expect(superseding).toBeTruthy();
    const sql = code(readFileSync(superseding as string, "utf8"));
    expect(sql).toContain("create or replace function public.streak_bonus_amount");
    expect(uncastUses(sql)).toEqual([]);
  });
});

/*
  The seed is the one that actually cost anybody time, so it is named rather
  than left to the sweep above: an uncast hash there stops the whole scale
  rehearsal, and the message a reader gets is a psql error on a line number.
*/
describe("the scale seed spreads its rows in 64 bits", () => {
  const SEED = readFileSync("supabase/scale/seed.sql", "utf8");

  it("casts every hash it adds to", () => {
    expect(uncastUses(code(SEED))).toEqual([]);
    expect(code(SEED)).toContain("abs(hashtext(p.id::text)::bigint)");
  });

  it("still spreads over the same pools, so the seeded data is unchanged", () => {
    expect(code(SEED)).toContain("% 40)");
    expect(code(SEED)).toContain("% 20000)");
  });
});
