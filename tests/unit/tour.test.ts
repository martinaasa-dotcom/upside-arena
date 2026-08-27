/*
  The walkthrough's two standing risks, both of them silent.

  It describes rooms and it quotes the rules of the game, and neither of those
  is checked by anything else: a room added to the dock with no sentence
  written for it renders an empty line, and a figure typed into the copy by
  hand drifts the day the constant behind it moves. Both look fine on screen.
*/
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ROOM_BLURB, STEPS } from "@/lib/tour-steps";
import { ROOMS } from "@/lib/rooms";
import { MAX_LINEUP_ORDERS, STARTING_BALANCE } from "@/lib/game";
import { MIN_WEEKS_TO_RANK } from "@/lib/game/season-rules";
import { DAILY_CAP } from "@/lib/notify/timing";
import { formatMoney } from "@/lib/format";

const ROOT = path.join(__dirname, "..", "..");

const prose = STEPS.map((s) => [s.title, s.lede, s.note ?? ""].join(" ")).join(" ");
const rows = STEPS.flatMap((s) => s.rows ?? []);
const rowProse = rows.map((r) => `${r.term} ${r.text}`).join(" ");
const everything = `${prose} ${rowProse}`;

describe("the map of the rooms", () => {
  it("has a sentence for every room the dock shows", () => {
    for (const room of ROOMS) {
      expect(ROOM_BLURB[room.href], room.href).toBeTruthy();
    }
  });

  it("describes no room that is not in the dock", () => {
    const real = new Set<string>(ROOMS.map((r) => r.href));
    for (const href of Object.keys(ROOM_BLURB)) {
      expect(real.has(href), href).toBe(true);
    }
  });

  it("names every room, so nothing is introduced without being named", () => {
    const step = STEPS.find((s) => s.key === "Rooms");
    expect(step).toBeDefined();
    const named = (step?.rows ?? []).map((r) => r.term);
    expect(named).toEqual(ROOMS.map((r) => r.label));
    for (const row of step?.rows ?? []) expect(row.text).not.toBe("");
  });
});

describe("the figures it quotes", () => {
  it("takes the starting balance from the game rather than the copy", () => {
    expect(everything).toContain(formatMoney(STARTING_BALANCE));
  });

  it("takes the lineup size, the season threshold and the daily cap the same way", () => {
    expect(everything).toContain(String(MAX_LINEUP_ORDERS));
    expect(everything).toContain(String(MIN_WEEKS_TO_RANK));
    expect(everything).toContain(String(DAILY_CAP));
  });
});

describe("the shape of a screen", () => {
  /*
    The dialog is a fixed height with one scroller in the middle, so a screen
    can be long. It cannot be long *and* dense: past six things the progress
    bar and the footer are pinned around a list nobody reads to the end of.
  */
  it("never puts more than five things on one screen", () => {
    for (const step of STEPS) {
      expect((step.rows ?? []).length, step.key).toBeLessThanOrEqual(5);
    }
  });

  it("gives every screen a short label for the step counter", () => {
    for (const step of STEPS) {
      expect(step.key.length, step.key).toBeLessThanOrEqual(10);
      expect(step.title.length, step.key).toBeGreaterThan(0);
      expect(step.lede.length, step.key).toBeGreaterThan(0);
    }
  });

  it("puts a mark on every row, so a screen is not a mix of labelled wells and bare ones", () => {
    for (const row of rows) {
      expect(row.icon, row.term).toBeTruthy();
    }
  });
});

describe("the lockup on the way in", () => {
  it("sits in the walkthrough header, not only behind the overlay", () => {
    const source = readFileSync(
      path.join(ROOT, "src/components/WelcomeTour.tsx"),
      "utf8"
    );
    expect(source).toMatch(/ArenaWordmark uid=\{`tour-\$\{index\}`\}/);
    expect(source.indexOf("<ArenaWordmark")).toBeLessThan(
      source.indexOf("overflow-y-auto")
    );
  });

  it("keeps the setup page lockup in the same bar the rooms use", () => {
    const page = readFileSync(
      path.join(ROOT, "src/app/onboarding/page.tsx"),
      "utf8"
    );
    const bar = readFileSync(
      path.join(ROOT, "src/components/BrandBar.tsx"),
      "utf8"
    );
    const header = readFileSync(
      path.join(ROOT, "src/components/AppHeader.tsx"),
      "utf8"
    );
    expect(page).toMatch(/<BrandBar room="Set up" \/>/);
    expect(page).not.toMatch(/justify-center/);
    expect(bar).toContain("HEADER_BAR");
    expect(bar).toContain('uid="header"');
    expect(header).toContain("<BrandBar");
    expect(header).toContain('href="/home"');
  });
});
