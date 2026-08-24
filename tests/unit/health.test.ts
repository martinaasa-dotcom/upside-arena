import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

/*
  The health check, read as source.

  It cannot be run here: every answer it gives comes from a database, a
  provider or a clock. What can be held is its shape, and the shape is the
  whole point of it. A check that returns 200 while a week has gone unscored
  for a day is worse than no check, because it is a check somebody trusts.
*/

const route = readFileSync("src/app/api/health/route.ts", "utf8");
const workflow = readFileSync(".github/workflows/health.yml", "utf8");

describe("what the health check asks", () => {
  it("asks about the database, the prices and the settlement", () => {
    for (const check of ["database", "prices", "settlement"]) {
      expect(route).toContain(`${check}:`);
    }
  });

  it("answers 503 when something is wrong, not 200 with a sad word in it", () => {
    // A ping that reads only the status code has to be able to tell.
    expect(route).toContain("status: ok ? 200 : 503");
  });

  it("is never cached, because a cached health check is yesterday's answer", () => {
    expect(route).toContain('"cache-control": "no-store"');
  });

  it("gives a stuck week longer than settling itself waits for a price", () => {
    // Settlement waits six hours before scoring around a company it cannot
    // price. An alarm inside that window would fire on a week that is doing
    // exactly what it was built to do.
    const hours = Number(
      /SETTLEMENT_ALARM_HOURS = (\d+)/.exec(route)?.[1] ?? "0"
    );
    expect(hours).toBeGreaterThan(6);
  });
});

describe("the thing that does the asking", () => {
  it("is scheduled rather than hoped for", () => {
    expect(workflow).toContain("schedule:");
    expect(workflow).toMatch(/cron: "\*\/30 \* \* \* \*"/);
  });

  it("tries twice before it calls it an outage", () => {
    // A single failed request is as likely to be a deploy as a fire.
    expect(workflow).toContain("for attempt in 1 2");
  });

  it("fails the run, which is what makes it an alarm", () => {
    expect(workflow).toContain("exit 1");
  });
});
