import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { getSharedCard } from "@/lib/game/share";
import { headline, ordinal, versusMarketLine, weekLabel } from "@/lib/share/card";
import { HEX, PRIMARY_RGB, SECONDARY_RGB, arenaMarkDataUri } from "@/lib/brand/mark";
import { formatPercent, plural } from "@/lib/format";

/*
  The picture that appears when a card is posted somewhere.

  This is the whole share loop in one image: for most people it is the only
  part of Arena they will ever see before deciding whether to look. So it has
  to say the result in about a second, and it has to be worth posting after a
  bad week, which is why nothing on it congratulates or scolds.

  Drawn in the locked tokens, converted to sRGB. The converter behind this
  understands neither oklch nor a backdrop blur, so the glass panel becomes
  the flat card colour, the same fallback the brand doc already documents for
  mail clients. What it must never do is invent a second palette.
*/

export const alt = "A week in Upside Arena";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/*
  Subset to the characters this card can contain, which takes three faces from
  400KB to 55KB. The converter has a hard bundle limit and a full weight would
  eat most of it on glyphs no share card will ever draw.
*/
const FONTS = path.join(process.cwd(), "assets", "fonts");

/*
  Read once per process rather than once per card.

  These three files are the same bytes on every request, and this route is hit
  by every unfurl of every link anyone has ever posted. Re-reading them off
  disk each time was three file reads standing between a chat app and the
  picture it is waiting to show.

  Held as the promise rather than the bytes so that two requests arriving
  together share one read instead of racing to do it twice.
*/
let faces: Promise<[Buffer, Buffer, Buffer]> | null = null;

function loadFaces() {
  faces ??= Promise.all([
    readFile(path.join(FONTS, "Geist-Regular.subset.ttf")),
    readFile(path.join(FONTS, "Geist-SemiBold.subset.ttf")),
    readFile(path.join(FONTS, "GeistMono-Medium.subset.ttf")),
  ]).catch((error) => {
    // A failed read must not poison every later request with a rejected
    // promise that is never retried.
    faces = null;
    throw error;
  }) as Promise<[Buffer, Buffer, Buffer]>;

  return faces;
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];

/**
 * The week as bars, drawn rather than typed.
 *
 * Zero is always in the scale, so a week that only ever went up is measured
 * from level rather than from its own worst day. Without that, five good days
 * would draw the same picture as five bad ones.
 */
function Shape({ marks }: { marks: number[] }) {
  if (marks.length === 0) return null;

  const low = Math.min(...marks, 0);
  const high = Math.max(...marks, 0);
  const range = high - low || 1;

  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 12 }}>
      {marks.map((mark, index) => {
        // A floor of a few pixels, so a flat day is still a mark on the card
        // rather than a gap where a day should be.
        const height = Math.max(6, ((mark - low) / range) * 96);
        return (
          <div
            key={index}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-end", height: 96 }}>
              <div
                style={{
                  width: 34,
                  height,
                  borderRadius: 4,
                  backgroundColor: mark >= 0 ? HEX.primary : HEX.loss,
                }}
              />
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

export default async function Image({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const card = await getSharedCard(token);

  const [regular, semibold, mono] = await loadFaces();

  const fonts = [
    { name: "Geist", data: regular, weight: 400 as const, style: "normal" as const },
    { name: "Geist", data: semibold, weight: 600 as const, style: "normal" as const },
    { name: "GeistMono", data: mono, weight: 500 as const, style: "normal" as const },
  ];

  /*
    Every element the converter sees needs display set explicitly the moment it
    holds more than one child, and a string with an interpolation in it counts
    as two. Rather than remember that at each call site, everything below is a
    flex box and every line of text is one string.
  */
  const line = (
    color: string,
    fontSize: number,
    extra: React.CSSProperties = {}
  ): React.CSSProperties => ({ display: "flex", color, fontSize, ...extra });

  const field: React.CSSProperties = {
    width: "100%",
    height: "100%",
    display: "flex",
    flexDirection: "column",
    backgroundColor: HEX.field,
    /*
      The ambient field. Product chrome follows
      the app: the near lobe in --primary aqua, matching the mark, and the far
      one in the magenta counter-accent.
    */
    backgroundImage:
      `radial-gradient(900px 720px at -4% -8%, rgba(${PRIMARY_RGB}, 0.30), transparent 66%),` +
      `radial-gradient(940px 720px at 100% 100%, rgba(${SECONDARY_RGB}, 0.16), transparent 72%)`,
    padding: 64,
    fontFamily: "Geist",
  };

  const wordmark = (
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      <img src={arenaMarkDataUri(34)} width={34} height={34} alt="" />
      <div style={{ display: "flex", fontSize: 24, letterSpacing: 0.5 }}>
        <span style={{ color: HEX.foreground, fontWeight: 600 }}>UPSIDE</span>
        <span style={{ color: HEX.foreground, fontWeight: 400 }}>&nbsp;ARENA</span>
      </div>
    </div>
  );

  // A link that no longer resolves still gets a picture, because a dead
  // preview in a group chat is worse than a plain one.
  if (!card) {
    return new ImageResponse(
      (
        <div style={{ ...field, justifyContent: "space-between" }}>
          {wordmark}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={line(HEX.foreground, 60, { fontWeight: 600 })}>
              This card is no longer shared
            </div>
            <div style={line(HEX.muted, 28)}>
              A free stock picking game. Play money only.
            </div>
          </div>
          <div style={line(HEX.muted, 24)}>upsidearena.com</div>
        </div>
      ),
      { ...size, fonts }
    );
  }

  const { recap } = card;
  const up = recap.returnPercent >= 0;
  const versus = versusMarketLine(recap.benchmarkDiff);

  const facts = [
    recap.league
      ? `${ordinal(recap.league.rank)} of ${recap.league.size} in ${recap.league.name}`
      : null,
    recap.streakDays > 0 ? `${plural(recap.streakDays, "day")} in a row` : null,
    recap.title,
  ].filter(Boolean) as string[];

  return new ImageResponse(
    (
      <div style={field}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          {wordmark}
          <div style={line(HEX.muted, 24)}>{`Week of ${weekLabel(recap.monday)}`}</div>
        </div>

        <div
          style={{
            display: "flex",
            flex: 1,
            marginTop: 36,
            padding: 44,
            borderRadius: 20,
            backgroundColor: HEX.card,
            border: `1px solid rgba(255, 255, 255, 0.12)`,
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
            <div style={line(HEX.muted, 26)}>{recap.displayName}</div>

            <div
              style={{
                display: "flex",
                fontFamily: "GeistMono",
                fontSize: 104,
                // Monospace gives the decimal point a whole cell to itself,
                // which at this size opens a gap you can park a bus in.
                letterSpacing: -4,
                lineHeight: 1.1,
                color: up ? HEX.gain : HEX.loss,
              }}
            >
              {formatPercent(recap.returnPercent)}
            </div>

            <div style={line(HEX.foreground, 34, { fontWeight: 600 })}>
              {headline(recap)}
            </div>

            {versus ? (
              <div style={line(HEX.muted, 26, { marginTop: 6 })}>{versus}</div>
            ) : null}
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-end",
              justifyContent: "space-between",
              height: "100%",
            }}
          >
            <Shape marks={recap.marks} />
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-end",
                gap: 6,
              }}
            >
              {facts.map((fact) => (
                <div key={fact} style={line(HEX.muted, 24)}>
                  {fact}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginTop: 28,
            color: HEX.muted,
            fontSize: 22,
          }}
        >
          <div style={{ display: "flex" }}>Play money only. Not financial advice.</div>
          <div style={{ display: "flex", color: HEX.primary }}>upsidearena.com</div>
        </div>
      </div>
    ),
    { ...size, fonts }
  );
}
