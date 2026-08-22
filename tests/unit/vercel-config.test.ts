import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const config = JSON.parse(
  readFileSync(join(process.cwd(), "vercel.json"), "utf8"),
) as Record<string, unknown>;

describe("vercel.json", () => {
  it("does not pin a region", () => {
    // On this plan a `regions` key stops Vercel creating the deployment at
    // all: no build, no failure, no comment, nothing in the log. The merge
    // just never reaches production. The region is a project setting
    // (Settings -> Functions), and docs/DEPLOY.md says why.
    expect(config).not.toHaveProperty("regions");
  });

  it("still refuses to deploy working branches", () => {
    // Every push to a claude/* branch used to buy a preview deployment.
    expect(config.git).toEqual({ deploymentEnabled: { "claude/*": false } });
  });
});
