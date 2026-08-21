import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/*
  A cron route that is not on the public list never runs.

  The proxy answers an unauthenticated request to anything under /api/ with a
  401 before the route is reached, which is right for everything a player
  calls and fatal for anything called by a schedule: those authenticate with a
  shared secret and have no session at all. The failure is silent, so it is
  worth catching here rather than in a week of notifications nobody received.
*/

const ROOT = path.join(__dirname, "..", "..");
const CRON = path.join(ROOT, "src", "app", "api", "cron");
const SESSION = path.join(ROOT, "src", "lib", "supabase", "session.ts");

function cronRoutes() {
  return readdirSync(CRON, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => `/api/cron/${entry.name}`);
}

describe("routes reached by a schedule rather than a player", () => {
  const source = readFileSync(SESSION, "utf8");
  const routes = cronRoutes();

  it("finds the cron routes at all, so an empty pass cannot look like a pass", () => {
    expect(routes.length).toBeGreaterThan(0);
  });

  it.each(routes)("%s is reachable without a session", (route) => {
    expect(source).toContain(`"${route}"`);
  });

  it.each(routes)("%s still refuses a caller with no secret", (route) => {
    const file = readFileSync(
      path.join(CRON, route.replace("/api/cron/", ""), "route.ts"),
      "utf8"
    );

    // Being public is only safe because the route itself closes when the
    // secret is unset. An unset variable must never be what opens something.
    expect(file).toContain("if (!secret) return false");
    expect(file).toContain("Not authorised");
  });
});
