import { describe, expect, it } from "vitest";
import {
  FAR_PEAK,
  ICON_BOX,
  LOCKUP,
  LOCKUP_LIFT,
  MARK_BOX,
  MARK_CENTROID_Y,
  NEAR_PEAK,
  peakPath,
} from "@/lib/brand/mark";

/*
  The lockup's one hand-placed number, checked against the drawing it came
  from.

  `LOCKUP_LIFT` lifts the mark off the centre line of the row it shares with
  the words, because a pair of triangles carries its weight along the baseline
  and centred by the numbers it reads as having sagged. How far to lift is
  half the distance between the middle of the drawing's box and where its ink
  actually balances -- a figure that comes from the outlines, so it goes stale
  the moment an apex or a foot moves, silently and in the one place a reader
  looks first.

  So the balance point is recomputed here from the same geometry the mark is
  drawn with, rather than trusted. A peak may move; the constant beside it has
  to move too.
*/

/** A path's points, in the order `peakPath` writes them. */
function points(path: string): [number, number][] {
  return [...path.matchAll(/(-?[\d.]+) (-?[\d.]+)/g)].map(([, x, y]) => [
    Number(x),
    Number(y),
  ]);
}

function inside(poly: [number, number][], x: number, y: number): boolean {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      hit = !hit;
    }
  }
  return hit;
}

/*
  The centre of area of the visible ink, sampled on a grid.

  Sampling rather than a shoelace sum because what is drawn is the union of
  the two peaks: the far one disappears under the near one, and the overlap is
  not a shape either outline describes. 900 steps across the 64 grid puts the
  answer inside a hundredth of a unit, which is far tighter than the tenth the
  constant is quoted to, and it runs in well under a second.

  The hairline cut is left out. It takes a sliver off the far peak's foot, it
  is a different width at every size the mark is drawn at, and it moves this
  by less than a tenth of a unit: a lockup cannot have a different lift at
  every size, so the number is taken from the outlines.
*/
function centroidY(): number {
  const near = points(peakPath(NEAR_PEAK));
  const far = points(peakPath(FAR_PEAK));
  const steps = 900;
  const step = 64 / steps;
  let area = 0;
  let sum = 0;
  for (let i = 0; i < steps; i++) {
    const y = (i + 0.5) * step;
    for (let j = 0; j < steps; j++) {
      const x = (j + 0.5) * step;
      if (inside(near, x, y) || inside(far, x, y)) {
        area += 1;
        sum += y;
      }
    }
  }
  return sum / area;
}

describe("the mark beside the words", () => {
  const measured = centroidY();

  it("balances where the constant says it does", () => {
    expect(measured).toBeCloseTo(MARK_CENTROID_Y, 1);
  });

  it("balances below the middle of its own box, which is the whole problem", () => {
    expect(measured).toBeGreaterThan(MARK_BOX.y + MARK_BOX.height / 2);
  });

  it("lifts by half of that, as a fraction of the size it is drawn at", () => {
    const half = (measured - (MARK_BOX.y + MARK_BOX.height / 2)) / 2;
    expect(LOCKUP_LIFT).toBeCloseTo(half / 64, 3);
  });

  it("stays a nudge rather than a shove", () => {
    // At the header's 20px mark this is about 1.4px. Anything approaching a
    // tenth of the drawing is no longer optical centring, it is a mark that
    // has come off the line.
    expect(LOCKUP_LIFT).toBeGreaterThan(0.03);
    expect(LOCKUP_LIFT).toBeLessThan(0.1);
  });
});

describe("the lockup's proportions", () => {
  /*
    What the mark's ink measures against the words beside it, which is the
    thing the two apps have to agree on. Lab draws its "A" at 1.4 times the
    type size; Arena's box is bigger than its ink, so the box has to be 1.12
    to land in the same place. If either number is edited on its own, this
    fails rather than the lockups quietly drifting apart again.
  */
  const INK = MARK_BOX.height / ICON_BOX;

  it("stands the mark 1.4 times the type size, which is Lab's", () => {
    const unit = 20;
    const ink = unit * LOCKUP.mark * INK;
    expect(ink / (unit * LOCKUP.type)).toBeCloseTo(1.4, 2);
  });

  it("keeps the header's 14px type", () => {
    expect(20 * LOCKUP.type).toBe(14);
  });

  it("scales as one object, so every part is a ratio of the unit", () => {
    for (const unit of [20, 34, 44]) {
      expect(unit * LOCKUP.mark * INK).toBeCloseTo(1.4 * unit * LOCKUP.type, 6);
      expect(unit * LOCKUP.gap).toBeCloseTo(unit * 0.5, 6);
    }
  });
});
