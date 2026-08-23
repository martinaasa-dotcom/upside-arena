import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/*
  The schema types are written by hand, because generating them needs project
  credentials that CI does not have. Hand-written means they can drift, and a
  drifted type is worse than none: it says a function exists that does not, or
  hides one that does.

  This walks the migrations and holds the two in step.
*/

const ROOT = path.join(__dirname, "..", "..");
const MIGRATIONS = path.join(ROOT, "supabase", "migrations");
const TYPES = path.join(ROOT, "src", "lib", "supabase", "database.types.ts");

function migrationSql() {
  return readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => readFileSync(path.join(MIGRATIONS, f), "utf8"))
    .join("\n");
}

/**
 * Functions the app may call, meaning those granted to a client role and not
 * since dropped.
 *
 * The migrations are read in order and a later one can take a function away.
 * Without the second pass this insists the types keep describing something
 * that no longer exists, which is the opposite of catching drift.
 */
function callableFunctions(sql: string) {
  const granted = new Set<string>();

  /*
    Grants and drops in the order they are written, not all of one and then
    all of the other.

    Sorting them by kind was wrong in one direction that has now come up: a
    migration that replaces a function with a wider signature drops the old
    one and grants the new one, and reading every drop last took the function
    out of the set although the schema still has it. The check then quietly
    stopped covering execute_trade, which is the single most important
    function in the app to have a correct type for.

    "drop function if exists" is included on purpose: a conditional drop still
    removes it.
  */
  const pattern =
    /(grant execute on function|drop function(?: if exists)?)\s+public\.([a-z_]+)\s*\(/gi;

  let match: RegExpExecArray | null;
  while ((match = pattern.exec(sql))) {
    const [, verb, name] = match;
    if (verb.startsWith("grant")) granted.add(name);
    else granted.delete(name);
  }

  return granted;
}

function declaredTables(sql: string) {
  const tables = new Set<string>();
  const pattern = /create table public\.([a-z_]+)/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(sql))) tables.add(match[1]);
  return tables;
}

describe("database types track the migrations", () => {
  const sql = migrationSql();
  const types = readFileSync(TYPES, "utf8");

  it("declares every table the migrations create", () => {
    for (const table of declaredTables(sql)) {
      expect(types, `${table} is missing from database.types.ts`).toContain(
        `${table}:`
      );
    }
  });

  it("declares every function the app is allowed to call", () => {
    for (const fn of callableFunctions(sql)) {
      expect(types, `${fn} is missing from database.types.ts`).toContain(`${fn}:`);
    }
  });

  it("found something to check, rather than passing on an empty search", () => {
    expect(declaredTables(sql).size).toBeGreaterThan(3);
    expect(callableFunctions(sql).size).toBeGreaterThan(3);
  });
});
