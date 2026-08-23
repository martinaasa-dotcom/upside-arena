/*
  The walkthrough's two standing risks, both of them silent.

  It describes rooms and it quotes the rules of the game, and neither of those
  is checked by anything else: a room added to the dock with no sentence
  written for it renders an empty line, and a figure typed into the copy by
  hand drifts the day the constant behind it moves. Both look fine on screen.
*/
import { describe, expect, it } from "vitest";
import { ROOM_BLURB, STEPS } from "@/lib/tour-steps";
import { ROOMS } from "@/lib/rooms";
import { MAX_LINEUP_ORDERS, STARTING_BALANCE } from "@/lib/game";
import { MIN_WEEKS_TO_RANK } from "@/lib/game/season-rules";
import { DAILY_CAP } from "@/lib/notify/timing";
import { formatMoney } from "@/lib/format";

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
});
