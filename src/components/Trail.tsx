import { formatPercent } from "@/lib/format";
import { trailShape } from "@/lib/game/shape";

/*
  A long contest, as the line it actually took.

  A week is five bars. A quarter is sixty-five, and sixty-five bars is a
  smear, so past a fortnight a contest is drawn as a line instead. What it is
  for is the same thing the week's bars are for: "up 12%" describes a run
  that climbed steadily and one that doubled and gave half of it back, and
  those are not the same quarter.

  The line across it is what everybody started with. Above it is ahead,
  below it is behind, and it is always somewhere in the box because zero is
  always in the scale -- a run that only ever went up, measured between its
  own worst day and its best, would draw the same picture as one that only
  ever went down.

  The right hand end is where it is right now, which is what the label under
  it says. There is no marker on it: the box is stretched to whatever width
  it is given, so a circle drawn in it comes out as an ellipse on a wide
  screen, and a dot that changes shape with the window is worse than no dot.
*/

/** Big enough to have a shape, small enough not to be the whole screen. */
const WIDTH = 600;
const HEIGHT = 120;

export function Trail({
  values,
  from,
  to,
}: {
  /** Every close, oldest first, with what it is worth right now on the end. */
  values: readonly number[];
  /** What to call the left edge and the right edge. */
  from: string;
  to: string;
}) {
  const shape = trailShape(values, WIDTH, HEIGHT);
  if (!shape) return null;

  const last = values[values.length - 1];

  return (
    <div className="flex flex-col gap-2">
      {/*
        The box is a little larger than the drawing so a two-pixel stroke at
        the very top, the very bottom or either end is not sliced in half by
        the edge. A run that touched its own high on the last day had the
        line clipped exactly where the eye goes.
      */}
      <svg
        viewBox={`-2 -2 ${WIDTH + 4} ${HEIGHT + 4}`}
        className="h-[120px] w-full"
        preserveAspectRatio="none"
        role="img"
        aria-label={`The contest so far, ending at ${formatPercent(last)}`}
      >
        {/*
          non-scaling-stroke on everything that is a line: the box is
          stretched to whatever width it is given, and without it the
          vertical parts of the path come out thicker than the horizontal
          ones on a wide screen and thinner on a phone.
        */}
        {/*
          Two fills and two lines rather than one of each, cut where the run
          crosses what everybody started with. Above it is aqua and below it
          is red, so the colour agrees with the position instead of being
          taken from wherever the run happens to have ended up.
        */}
        <path d={shape.aheadArea} className="fill-primary/15" stroke="none" />
        <path d={shape.behindArea} className="fill-loss/15" stroke="none" />

        <line
          x1="0"
          x2={WIDTH}
          y1={shape.zeroY}
          y2={shape.zeroY}
          className="stroke-border"
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
        />

        <path
          d={shape.aheadLine}
          fill="none"
          className="stroke-primary"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d={shape.behindLine}
          fill="none"
          className="stroke-loss"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />

      </svg>

      <div className="flex items-baseline justify-between text-xs text-muted-foreground">
        <span>{from}</span>
        <span>{to}</span>
      </div>
    </div>
  );
}
