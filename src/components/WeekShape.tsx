import { formatPercent } from "@/lib/format";
import type { ShapeDay } from "@/lib/game/shape";

/*
  A week as five bars, hung from the line where you started.

  The single percentage says how it ended; this says how it went. That is the
  part worth looking at twice, and the part that makes a card worth posting
  when the ending was bad: a week that climbed all week and gave it back on
  Friday is a story, and "-1.2%" on its own is not.

  The line across the middle is what you started with, and it is the whole
  point. Bars used to grow upwards from the floor of the chart, scaled between
  the worst day and the best, which drew a day that was down one per cent as a
  short bar rather than as a day below water. Colour said it and the shape
  contradicted it. Now a losing day hangs, and being behind is something you
  can see across the room.

  It draws two kinds of week. A finished one, where every bar is a settled
  close, and the one in progress, where the last bar is a live price and is
  outlined rather than filled so nobody mistakes it for final. Days that have
  not happened are an empty track: the week keeps its width all week, so the
  panel does not change size under somebody between Tuesday and Wednesday.
*/

/** The height of the plot, in pixels, not counting the line through it. */
const PLOT = 72;

/** So a day that barely moved is still a day and not a gap in the row. */
const FLOOR = 3;

export function WeekShape({ days }: { days: readonly ShapeDay[] }) {
  if (days.length === 0) return null;

  const values = days
    .map((day) => day.returnPercent)
    .filter((value): value is number => value != null);

  if (values.length === 0) return null;

  /*
    Zero is always in range, so the line is always somewhere in the plot. A
    week that only ever went up puts it on the floor and every bar stands on
    it; a week that only ever went down puts it on the ceiling and every bar
    hangs from it. Both are the true picture of that week.
  */
  const high = Math.max(...values, 0);
  const low = Math.min(...values, 0);
  const span = high - low;

  // A week that did not move at all: split it evenly rather than divide by
  // nothing, and every day draws as the floor above the line.
  const above = span === 0 ? PLOT / 2 : (high / span) * PLOT;
  const below = PLOT - above;

  return (
    /*
      Fills whatever it is given. There was a cap here for a while, put in
      after the bars were photographed at nine hundred pixels across and
      looked like billboards -- but that width only exists in the gallery,
      where each case gets the whole page. In the app the widest this is ever
      drawn is one column of the two-column room, about seven hundred, and the
      share page is narrower still.

      What the cap actually did was leave the bars stopping two thirds of the
      way across a panel whose other chart ran the full width of it, which
      reads as something failing rather than as a considered content width.
    */
    <div className="flex items-end gap-2">
      {days.map((day, index) => {
        const value = day.returnPercent;
        const up = value != null && value >= 0;

        const height =
          value == null
            ? 0
            : span === 0
              ? FLOOR
              : Math.max(FLOOR, (Math.abs(value) / span) * PLOT);

        const title =
          value == null
            ? `${day.label}: not yet`
            : `${day.label}: ${formatPercent(value)}${day.live ? " so far" : ""}`;

        const fill = day.live
          ? `border border-dashed ${
              up ? "border-primary bg-primary/25" : "border-loss bg-loss/20"
            }`
          : up
            ? "bg-primary"
            : "bg-loss/85";

        return (
          <div key={index} className="flex flex-1 flex-col items-center gap-2">
            <div
              className="w-full rounded-sm bg-foreground/[0.04]"
              title={title}
              style={{ height: PLOT + 1 }}
            >
              {/* Everything above the line, sitting on it. */}
              <div className="flex w-full flex-col justify-end" style={{ height: above }}>
                {value != null && up ? (
                  <div className={`w-full rounded-t-sm ${fill}`} style={{ height }} />
                ) : null}
              </div>

              {/* What you started with. */}
              <div className="h-px w-full bg-border" />

              {/* And everything below it, hanging from it. */}
              <div className="flex w-full flex-col justify-start" style={{ height: below }}>
                {value != null && !up ? (
                  <div className={`w-full rounded-b-sm ${fill}`} style={{ height }} />
                ) : null}
              </div>
            </div>

            <span
              className={`text-xs ${
                day.live ? "font-medium text-foreground" : "text-muted-foreground"
              }`}
            >
              {day.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
