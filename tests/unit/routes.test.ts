import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/*
  A route that is not on the public list never runs.

  The proxy answers an unauthenticated request to anything under /api/ with a
  401 before the route is reached. That is right for everything a player calls
  and fatal for anything called by a machine: a schedule authenticates with a
  shared secret and a payment provider by signing the body, and neither has a
  session. The failure is silent from the inside, so it is worth catching here
  rather than in a week of notifications nobody received, or a month of
  subscriptions nobody was given.

  Both of these have now happened once each, which is why the test covers both.
*/

const ROOT = path.join(__dirname, "..", "..");
const CRON = path.join(ROOT, "src", "app", "api", "cron");
const SESSION = path.join(ROOT, "src", "lib", "supabase", "session.ts");

function cronRoutes() {
  return readdirSync(CRON, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => `/api/cron/${entry.name}`);
}

/** Anything a payment provider calls, found rather than listed by hand. */
function webhookRoutes() {
  const api = path.join(ROOT, "src", "app", "api");
  const found: string[] = [];

  const walk = (dir: string, prefix: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const here = path.join(dir, entry.name);
      if (entry.name === "webhook") found.push(`${prefix}/${entry.name}`);
      else walk(here, `${prefix}/${entry.name}`);
    }
  };

  walk(api, "/api");
  return found;
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

describe("routes called by a payment provider", () => {
  const source = readFileSync(SESSION, "utf8");
  const routes = webhookRoutes();

  it.each(routes)("%s is reachable without a session", (route) => {
    /*
      Stripe signs the request body; it has no session and never will. Left
      off the public list this endpoint answers 401 to Stripe, which retries
      for days while nobody's subscription is ever recorded. Nothing about
      that failure is visible from inside the app.
    */
    expect(source).toContain(`"${route}"`);
  });

  it.each(routes)("%s still verifies the signature itself", (route) => {
    const file = readFileSync(
      path.join(ROOT, "src", "app", ...route.slice(1).split("/"), "route.ts"),
      "utf8"
    );

    // Being public is only safe because the route refuses anything it cannot
    // verify. An unverified webhook body is a stranger claiming somebody paid.
    expect(file).toContain("verifyWebhook");
    expect(file).toContain("Bad signature");
  });
});
