import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/*
  Every room has to answer a tap.

  It used to be that none of these could be prerendered -- each page awaited a
  session and its data before returning a single element -- so each one carried
  a loading.tsx, and what a tap produced was a grey skeleton for as long as the
  slowest query took. This file checked those skeletons existed.

  Cache Components changed what is possible: static and dynamic are decided per
  component, not per route. A page that does not await can be prerendered down
  to the first Suspense boundary, and that shell is in the browser before the
  tap. The room paints with its heading and its labels already true, and only
  the figures stream in.

  So the check is now the property that makes that work, and it is the one that
  is silently easy to lose: a page whose default export is `async` blocks the
  whole route from prerendering, and it renders perfectly well while doing it.
  Nothing goes red. It is only slow, and only on a real connection, which is
  not where anybody builds it.
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

  it.each(found)("%s can be prerendered, so a tap paints it", (route) => {
    const dir = path.join(ROOMS, ...route.slice(1).split("/"));
    const source = readFileSync(path.join(dir, "page.tsx"), "utf8");

    /*
      An async default export is the whole failure. Everything below it waits
      on whatever it awaits, there is no shell to send, and the route falls
      back to a skeleton.
    */
    expect(
      source,
      `${route} awaits before it returns, so nothing can be prerendered`
    ).not.toMatch(/export default async function/);

    // And it has to hand the waiting to something, or it is a page that shows
    // its frame and never fills it.
    expect(source, `${route} has no Suspense boundary`).toContain("Suspense");
  });

  it.each(found)("%s does not put a skeleton in front of its own shell", (route) => {
    const dir = path.join(ROOMS, ...route.slice(1).split("/"));

    /*
      A loading.tsx replaces the prerendered shell during navigation, so once a
      room has a real frame the skeleton is the thing hiding it.
    */
    expect(existsSync(path.join(dir, "loading.tsx"))).toBe(false);
  });

  /*
    And the same rule where it actually bit.

    The check above asked each room about its own directory, so it went green
    with a loading.tsx sitting one level up in (app), above all of them, doing
    the identical thing to every single room. Every per-room skeleton was
    deleted and that one survived, because nothing was looking there: the
    rooms were rewritten to paint on the tap and then had a grey rectangle
    drawn over them on every tap for the trouble.

    A boundary above a route can only hide the route. Anywhere at or above
    (app) is that, so the check walks up from each room to the group root
    rather than asking about one directory.
  */
  it("has no loading boundary above the rooms either", () => {
    const above = new Set<string>();

    for (const route of found) {
      const parts = route.slice(1).split("/");
      // Every directory from (app) down to the room's own parent.
      for (let depth = 0; depth < parts.length; depth += 1) {
        above.add(path.join(ROOMS, ...parts.slice(0, depth)));
      }
    }

    expect(above.size).toBeGreaterThan(0);

    for (const dir of above) {
      expect(
        existsSync(path.join(dir, "loading.tsx")),
        `${dir} has a loading.tsx, which covers every room under it`
      ).toBe(false);
    }
  });

  /*
    A whole-room placeholder has no shape that is right any more. Kept as a
    check on the component rather than the file, because the way this comes
    back is somebody needing a fallback, finding one that fits a whole page,
    and putting it where it does not belong.
  */
  it("has no whole-room placeholder left to reach for", () => {
    const skeleton = readFileSync(
      path.join(ROOT, "src", "components", "Skeleton.tsx"),
      "utf8"
    );

    expect(skeleton).not.toContain("RoomSkeleton");
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
