import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/*
  Everything a room draws is now cached, which moves the risk.

  A stale price is a small thing. A stale portfolio right after a trade is the
  player being told their trade did not happen, and there is no worse thing
  for this app to say. Time does not fix it either -- the whole point of the
  cache is that it lasts minutes -- so the only thing that fixes it is every
  mutation saying so.

  revalidatePath does not do this job. It clears the rendered route, not the
  tagged reads behind it, so a page rebuilt after a trade is rebuilt from the
  same numbers it had before the trade. Every action here already called it,
  which is exactly why this is easy to believe is handled.

  So: an action that writes must drop the player's tag. Checked as a property
  of the file rather than of one action, because the way this breaks is a new
  action written next year by someone reading the file next to it.
*/

const ROOT = path.join(__dirname, "..", "..");
const APP = path.join(ROOT, "src", "app");

/** Every "use server" file under the app. */
function actionFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const here = path.join(dir, entry);
    if (statSync(here).isDirectory()) {
      found.push(...actionFiles(here));
      continue;
    }
    if (!entry.endsWith(".ts")) continue;
    const source = readFileSync(here, "utf8");
    if (source.startsWith('"use server"')) found.push(here);
  }
  return found;
}

/*
  Files that write nothing a room reads.

  Each is a reason. Anything not listed and not dropping a tag is a bug this
  check exists to name.
*/
const WRITES_NOTHING_A_ROOM_READS: Record<string, string> = {
  "auth/actions.ts": "signs in and records consent; no room reads either",
  "handoff-actions.ts": "records that an offer was seen, which nothing draws",
};

describe("a mutation drops what a room would otherwise redraw", () => {
  const files = actionFiles(APP);

  it("finds the actions, so an empty pass cannot look like a pass", () => {
    expect(files.length).toBeGreaterThan(8);
  });

  it.each(files.map((f) => [path.relative(APP, f), f] as const))(
    "%s",
    (relative, file) => {
      const source = readFileSync(file, "utf8");

      const excused = Object.keys(WRITES_NOTHING_A_ROOM_READS).find((key) =>
        relative.endsWith(key)
      );
      if (excused) {
        // Still has to be true: an excused file must not be quietly writing.
        expect(source).not.toContain("revalidatePath(");
        return;
      }

      /*
        revalidatePath is the marker for "this changed something drawn". Every
        file that calls it has to drop the tag as well, and in the same breath
        -- the path clears the page, the tag clears the numbers on it.
      */
      if (!source.includes("revalidatePath(")) return;

      expect(
        source.includes("playerChanged("),
        `${relative} clears a page after writing but not the cached reads behind it, so the page comes back with the numbers it had before`
      ).toBe(true);
    }
  );
});
