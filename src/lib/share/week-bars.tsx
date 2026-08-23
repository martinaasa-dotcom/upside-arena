import { HEX } from "@/lib/brand/mark";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];

/** The height of the plot, in pixels, not counting the line through it. */
const PLOT = 96;

/** So a day that barely moved is still a day and not a gap in the row. */
const FLOOR = 4;

/**
 * The week as bars, hung from the line where you started.
 *
 * The same drawing the app makes, and for a while it was not. Zero has always
 * been in the scale here, so a week that only ever went up is measured from
 * level rather than from its own worst day -- but the bars still grew upwards
 * from the floor of the box, which means on a week whose worst day was -2.6%
 * that worst day was the shortest bar on the card. Colour said down and the
 * shape said barely anything.
 *
 * A losing day hangs now. This is the card other people see, so it is the
 * last place that should be drawing a bad week as a small one.
 */
export function WeekBars({ marks }: { marks: (number | null)[] }) {
  const played = marks.filter((mark): mark is number => mark != null);
  if (played.length === 0) return null;

  const high = Math.max(...played, 0);
  const low = Math.min(...played, 0);
  const span = high - low;

  // A week that did not move at all: split it evenly rather than divide by
  // nothing, and every day draws as the floor above the line.
  const above = span === 0 ? PLOT / 2 : (high / span) * PLOT;
  const below = PLOT - above;

  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 12 }}>
      {marks.map((mark, index) => {
        const up = mark != null && mark >= 0;

        const height =
          mark == null ? 0 : span === 0 ? FLOOR : Math.max(FLOOR, (Math.abs(mark) / span) * PLOT);

        return (
          <div
            key={index}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            {/*
              A day the player was not here for keeps its place and stays
              empty. Leaving it out would slide Friday under Wednesday, which
              is the other thing this card was getting wrong.
            */}
            <div style={{ display: "flex", flexDirection: "column", width: 34 }}>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "flex-end",
                  height: above,
                }}
              >
                {mark != null && up ? (
                  <div
                    style={{
                      width: 34,
                      height,
                      borderTopLeftRadius: 4,
                      borderTopRightRadius: 4,
                      backgroundColor: HEX.primary,
                    }}
                  />
                ) : null}
              </div>

              {/* What everybody started with. */}
              <div style={{ display: "flex", width: 34, height: 1, backgroundColor: HEX.well }} />

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "flex-start",
                  height: below,
                }}
              >
                {mark != null && !up ? (
                  <div
                    style={{
                      width: 34,
                      height,
                      borderBottomLeftRadius: 4,
                      borderBottomRightRadius: 4,
                      backgroundColor: HEX.loss,
                    }}
                  />
                ) : null}
              </div>
            </div>

            <div
              style={{
                display: "flex",
                marginTop: 8,
                color: HEX.muted,
                fontSize: 18,
              }}
            >
              {DAYS[index] ?? String(index + 1)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

