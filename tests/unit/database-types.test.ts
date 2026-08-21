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

/** Functions the app may call, meaning those granted to a client role. */
function callableFunctions(sql: string) {
  const granted = new Set<string>();
  const pattern = /grant execute on function public\.([a-z_]+)\s*\(/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(sql))) granted.add(match[1]);
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
