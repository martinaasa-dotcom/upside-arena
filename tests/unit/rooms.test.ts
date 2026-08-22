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
