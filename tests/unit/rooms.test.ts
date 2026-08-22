import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/*
  Every room has to answer a tap.

  A room here reads live data, so none of them can be prerendered, and Next
  does not prefetch a route it cannot prerender unless the route has a loading
  boundary. Without one the whole navigation waits on the server: the tap
  lands, the dock does not change, the screen does not change, and the app
  reads as broken rather than as busy. Measured against a room that takes four
  seconds, the difference is the URL changing within a frame instead of after
  four seconds of nothing.

  This is a file on disk rather than a habit, because the failure is silent.
  A room with no loading.tsx renders perfectly well; it is only slow, and only
  on a real connection, which is not where anybody builds it.
*/

const ROOT = path.join(__dirname, "..", "..");
const ROOMS = path.join(ROOT, "src", "app", "(app)");

/** Every routable segment under the signed-in layout, nested ones included. */
function rooms(dir: string, prefix: string): string[] {
  const found: string[] = [];

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const here = path.join(dir, entry.name);
    const route = `${prefix}/${entry.name}`;
    if (existsSync(path.join(here, "page.tsx"))) found.push(route);
    found.push(...rooms(here, route));
  }

  return found;
}

describe("the rooms behind the dock", () => {
  const found = rooms(ROOMS, "");

  it("finds them at all, so an empty pass cannot look like a pass", () => {
    expect(found.length).toBeGreaterThan(4);
  });

  it.each(found)("%s can show something the moment it is tapped", (route) => {
    const dir = path.join(ROOMS, ...route.slice(1).split("/"));
    expect(existsSync(path.join(dir, "loading.tsx"))).toBe(true);
  });
});

describe("the way to Arena Plus", () => {
  const header = readFileSync(
    path.join(ROOT, "src", "components", "AppHeader.tsx"),
    "utf8"
  );

  /*
    The shop used to be one button seven panels down the profile page, which
    is not somewhere anybody finds anything. It cannot go in the dock, which is
    measured to the pixel and full at five rooms, so it lives in the header and
    has to stay there.
  */
  it("is on every screen, in the header", () => {
    expect(header).toContain('href="/plus"');
  });
});
