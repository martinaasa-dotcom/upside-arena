/*
  The migration checker's blind spot, and the answer it gives now.

  `scripts/migration-state.py` works out which migrations a project has from
  what it holds, because there is no ledger table. Everything it knows comes
  from an inventory of tables and of functions by name and parameter count, and
  a migration is judged by whether the things it creates are there.

  A `create or replace function` that changes only the body creates nothing.
  Same name, same parameter count, same row in pg_proc. On presence alone such
  a migration reads "applied" against a project that has never seen it, which
  is the one answer this tool exists to prevent: it is the shape that once read
  0026 as applied because score_cycle had existed since 0003, and 0026 was
  caught only because it happened to add a parameter.

  So the body is compared instead, and `test-migration-state.sh` exercises that
  end to end against a real Postgres. It does it only incidentally, though: it
  builds a database one migration short of the newest, and today the newest
  happens to be a body-only one. The day anything else lands on top, that
  coverage quietly goes away and nothing says so.

  This is the part that does not depend on what the newest migration is. It
  feeds the checker migrations and an inventory made up on the spot, so every
  case is stated rather than arranged for, and no database is involved.
*/
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const md5 = (text: string) => createHash("md5").update(text).digest("hex");

/** Run the checker over a made-up set of migrations and a made-up project. */
function report(
  migrations: Record<string, string>,
  inventory: string[],
  namesOnly = false
): string {
  const dir = mkdtempSync(join(tmpdir(), "migration-state-"));
  for (const [name, sql] of Object.entries(migrations)) {
    writeFileSync(join(dir, name), sql);
  }
  const args = ["scripts/migration-state.py", dir];
  if (namesOnly) args.push("--names-only");
  return execFileSync("python3", args, {
    input: inventory.join(" "),
    encoding: "utf8",
  });
}

const OLD_BODY = "\n  select 1\n";
const NEW_BODY = "\n  select 2\n";

const fn = (body: string) =>
  `create or replace function public.pay(p_user uuid, p_day integer)\n` +
  `returns integer language sql immutable as $$${body}$$;\n`;

/** A project that has the first migration and, maybe, the second. */
const project = (body: string) => [
  "function:pay:2",
  `body:pay:2:${md5(body)}`,
];

const BODY_ONLY = {
  "0001_pay.sql": fn(OLD_BODY),
  "0002_fix_pay.sql": fn(NEW_BODY),
};

describe("a migration that only replaces a body", () => {
  it("is not called applied by a project that never ran it", () => {
    const out = report(BODY_ONLY, project(OLD_BODY));
    expect(out).toMatch(/0002_fix_pay\s+MISSING/);
    expect(out).toContain("1 missing");
  });

  it("names the function rather than a hash nobody can read", () => {
    expect(report(BODY_ONLY, project(OLD_BODY))).toContain("body of pay");
  });

  it("is applied once the project carries that body", () => {
    const out = report(BODY_ONLY, project(NEW_BODY));
    expect(out).toMatch(/0002_fix_pay\s+applied/);
    expect(out).toContain("Nothing missing.");
  });

  it("is in the list --all would apply, so it can be caught up", () => {
    expect(report(BODY_ONLY, project(OLD_BODY), true).trim()).toBe(
      "0002_fix_pay"
    );
    expect(report(BODY_ONLY, project(NEW_BODY), true).trim()).toBe("");
  });

  it("says so rather than guessing when there is no body to read", () => {
    const out = report(
      {
        "0001_pay.sql": fn(OLD_BODY),
        "0002_fix_pay.sql":
          "create or replace function public.pay(p_user uuid, p_day integer)\n" +
          "returns integer language sql immutable return 2;\n",
      },
      project(OLD_BODY)
    );
    expect(out).toContain("cannot be judged");
    expect(out, "an unreadable body is not a reason to cry wolf").toContain(
      "Nothing missing."
    );
  });
});

/*
  The other half: the body is a fallback for the case presence cannot answer,
  never a second opinion on the cases it can. Judging every migration on its
  bodies would report the first one here as missing for ever, because a
  healthy project holds the second one's body, and that is the crying wolf the
  checker's own notes warn about.
*/
describe("everything presence can still answer, it answers", () => {
  it("leaves the superseded migration superseded, not missing", () => {
    const out = report(BODY_ONLY, project(NEW_BODY));
    expect(out).toMatch(/0001_pay\s+superseded/);
  });

  it("judges a migration that also creates a table on the table", () => {
    const migrations = {
      "0001_pay.sql": fn(OLD_BODY),
      "0002_fix_pay.sql": `create table public.ledger (id uuid);\n${fn(NEW_BODY)}`,
    };
    /* The body is the new one, so only the table can say it did not run. */
    const out = report(migrations, project(NEW_BODY));
    expect(out).toMatch(/0002_fix_pay\s+MISSING/);
    expect(out).toContain("table:ledger");
  });

  it("still sees a replacement that changes the parameter count", () => {
    const migrations = {
      "0001_pay.sql": fn(OLD_BODY),
      "0002_fix_pay.sql":
        "create or replace function public.pay(p_user uuid, p_day integer, " +
        `p_extra integer)\nreturns integer language sql immutable as $$${NEW_BODY}$$;\n`,
    };
    expect(report(migrations, project(OLD_BODY))).toMatch(
      /0002_fix_pay\s+MISSING/
    );
  });
});
