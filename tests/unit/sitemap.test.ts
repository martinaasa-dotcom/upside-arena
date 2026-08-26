import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { ROOMS } from "@/lib/rooms";

/*
  The sitemap has to agree with the dock it describes.

  docs/SITEMAP.md is the answer to "is there a screen nobody can reach", and
  the way it answers is by naming the dock and then saying everything else is
  two taps from it. That makes the dock's own contents load-bearing prose: get
  them wrong and the document quietly stops proving the thing it exists to
  prove.

  It did get them wrong. Season left the dock and moved to Profile, and the
  sitemap went on saying the navigation was "deliberately five things" with
  `/season` listed as a dock tab. Nothing failed, because no test had any
  reason to read a markdown file, and the drift is invisible from inside the
  app: the dock was right, only the description of it was wrong.

  So the check is the one fact both sides state independently -- which rooms
  are in the bar -- read out of `ROOMS`, which is what actually draws it.
*/

const SITEMAP = path.join(__dirname, "..", "..", "docs", "SITEMAP.md");

const NUMBER = new Map([
  [1, "One"],
  [2, "Two"],
  [3, "Three"],
  [4, "Four"],
  [5, "Five"],
  [6, "Six"],
]);

function sitemap(): string {
  return readFileSync(SITEMAP, "utf8");
}

/** The `How you get there` cell for a route, or null when it is not listed. */
function wayIn(doc: string, route: string): string | null {
  const row = doc
    .split("\n")
    .find((line) => line.startsWith(`| \`${route}\` |`));
  if (!row) return null;
  return row.split("|")[3]?.trim() ?? null;
}

describe("docs/SITEMAP.md describes the dock the app actually draws", () => {
  it("counts the dock's rooms the way ROOMS does", () => {
    const doc = sitemap();
    const word = NUMBER.get(ROOMS.length);
    expect(word).toBeDefined();
    expect(doc).toContain(`${word} of these are the dock`);
    expect(doc).toContain(
      `the whole of the navigation and is deliberately ${word!.toLowerCase()} things`
    );
  });

  it("lists every dock room, and says the dock is the way in", () => {
    const doc = sitemap();
    for (const room of ROOMS) {
      const how = wayIn(doc, room.href);
      expect(how, `${room.href} is not a row in the sitemap`).not.toBeNull();
      expect(how, `${room.href} is in the dock but the sitemap does not say so`)
        .toMatch(/Dock/);
    }
  });

  /*
    The other half, and the one that actually broke: a route the dock does
    not carry must not claim the dock as its way in. Without this the check
    passes on a sitemap that lists every real tab and three invented ones.
  */
  it("claims the dock for nothing else", () => {
    const doc = sitemap();
    const inDock = new Set<string>(ROOMS.map((r) => r.href));
    const liars = doc
      .split("\n")
      .filter((line) => /^\| `\/[^`]*` \|/.test(line))
      .map((line) => ({
        route: line.split("`")[1],
        how: line.split("|")[3]?.trim() ?? "",
      }))
      .filter(({ route, how }) => !inDock.has(route) && /\bDock\b/.test(how))
      .map(({ route }) => route);
    expect(liars).toEqual([]);
  });

  /*
    A check that reads nothing passes for the wrong reason. Season is the
    room this whole file was written for: it is in the sitemap, it is not in
    the dock, and Profile is how you reach it.
  */
  it("reads the real table", () => {
    const doc = sitemap();
    expect(ROOMS.some((r) => r.href === "/season")).toBe(false);
    expect(wayIn(doc, "/season")).toMatch(/Profile/);
    expect(wayIn(doc, "/home")).toMatch(/Dock/);
    expect(wayIn(doc, "/nothing-is-here")).toBeNull();
  });
});
