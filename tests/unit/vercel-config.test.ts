import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const config = JSON.parse(
  readFileSync(join(process.cwd(), "vercel.json"), "utf8"),
) as Record<string, unknown>;

describe("vercel.json", () => {
  it("does not pin a region", () => {
    // The region is set on the Vercel project (Settings -> Functions), which
    // is what is actually in effect. A `regions` key here would be a second
    // place to write the same thing, and two of those disagree eventually
    // without anyone noticing which one won. docs/DEPLOY.md has the rest.
    expect(config).not.toHaveProperty("regions");
  });

  it("still refuses to deploy working branches", () => {
    // Every push to a claude/* branch used to buy a preview deployment.
    expect(config.git).toEqual({ deploymentEnabled: { "claude/*": false } });
  });
});
