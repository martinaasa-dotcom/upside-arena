import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { WeekBars } from "@/lib/share/week-bars";
import { arenaMarkDataUri } from "@/lib/brand/mark";

/*
  The one drawing in this product that nothing else could check.

  The shared card's image is built by a converter that supports a subset of
  CSS and throws on the rest -- notably, every element holding more than one
  child has to set display explicitly, and a string with an interpolation in
  it counts as two children. Get that wrong and the route does not render a
  worse picture, it renders none, and the failure lands in somebody's group
  chat rather than in a test run.

  Nothing else reaches it. The browser suite asks the route for a link that
  has gone, which takes the fallback path and never touches these bars, and
  a real card needs a database. So the bars are their own module and this
  puts them through the actual converter.

  Fast enough to keep: about a quarter of a second, no network, and the fonts
  are the ones committed to the repository.
*/

let face: Promise<Buffer> | null = null;

function regular() {
  face ??= readFile(
    path.join(process.cwd(), "assets", "fonts", "Geist-Regular.subset.ttf")
  );
  return face;
}

async function draw(marks: (number | null)[]) {
  const element = WeekBars({ marks });
  if (element == null) return null;

  const { ImageResponse } = await import("next/og");

  const response = new ImageResponse(element as React.ReactElement, {
    width: 400,
    height: 200,
    fonts: [
      { name: "Geist", data: await regular(), weight: 400 as const, style: "normal" as const },
    ],
  });

  return new Uint8Array(await response.arrayBuffer());
}

function isPng(bytes: Uint8Array | null) {
  return bytes != null && [...bytes.slice(0, 4)].join() === [0x89, 0x50, 0x4e, 0x47].join();
}

describe("the picture other people see", () => {
  it("draws an ordinary week", async () => {
    const bytes = await draw([1.2, -0.4, 3.9, 0.1, -2.6]);
    expect(isPng(bytes)).toBe(true);
  }, 60_000);

  /*
    The layout that had to be rebuilt for this. Bars used to grow from the
    floor, so a week's worst day was its shortest bar; they hang from a line
    at what everybody started with now, which means each day is three nested
    boxes rather than one and is exactly the sort of thing the converter
    refuses.
  */
  it("draws a week that only lost, where every bar hangs", async () => {
    expect(isPng(await draw([-1, -2, -3, -4, -5]))).toBe(true);
  }, 60_000);

  it("draws a week that only gained, where every bar stands", async () => {
    expect(isPng(await draw([1, 2, 3, 4, 5]))).toBe(true);
  }, 60_000);

  it("draws a week that did not move, without dividing by nothing", async () => {
    expect(isPng(await draw([0, 0, 0, 0, 0]))).toBe(true);
  }, 60_000);

  it("draws a week somebody joined halfway through", async () => {
    expect(isPng(await draw([null, null, 1.2, 2.8, 0.4]))).toBe(true);
  }, 60_000);

  /*
    The mark on the card is the same drawing as the mark in the app, handed
    to the converter as an SVG data URI -- and the hairline that parts its
    two peaks is cut with a `<mask>`, because the mark is transparent and
    there is no one colour to paint the gap with.

    That mask is a feature of the SVG rasteriser rather than of the CSS
    subset the rest of this file worries about, and nothing else in the suite
    goes near it. A rasteriser that ignored it would not fail: it would draw
    the far peak whole, the two would fuse, and the logo in somebody's group
    chat would quietly be a blob.
  */
  it("draws the mark, hairline and all, through the same converter", async () => {
    const { ImageResponse } = await import("next/og");
    const card = new ImageResponse(
      {
        type: "div",
        key: null,
        props: {
          style: {
            display: "flex",
            width: "100%",
            height: "100%",
            background: "#000",
          },
          children: {
            type: "img",
            key: null,
            props: { src: arenaMarkDataUri(120), width: 120, height: 120 },
          },
        },
      } as unknown as React.ReactElement,
      { width: 160, height: 160 }
    );
    const bytes = new Uint8Array(await card.arrayBuffer());
    expect(isPng(bytes)).toBe(true);

    /*
      And it drew something. A converter that choked on the mask and dropped
      the image would still hand back a valid PNG -- just an empty one -- so
      the size is what says a mark actually arrived.
    */
    expect(bytes.byteLength).toBeGreaterThan(2_000);
  }, 60_000);

  it("draws nothing at all rather than an empty frame", async () => {
    // No closes means no card worth putting a chart on, and returning null
    // is what lets the caller leave the space out.
    expect(WeekBars({ marks: [null, null, null, null, null] })).toBeNull();
    expect(WeekBars({ marks: [] })).toBeNull();
  });
});
