/*
  Rebuilds the mono subset the app ships.

  The ranges live in src/lib/brand/mono-subset.ts rather than in this file, so
  that the same list decides what is in the font, what the test checks, and
  what this command asks for. A README that had to be kept level with a font
  file by hand is exactly how the block characters would go missing.

  Needs fonttools:  pip install fonttools brotli
*/

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const SOURCE =
  "node_modules/geist/dist/fonts/geist-mono/GeistMono-Variable.ttf";
const OUTPUT = "assets/fonts/GeistMono-Variable.subset.woff2";

/*
  Read out of the TypeScript rather than imported, so this script needs no
  build step and no loader. The shape it is looking for is the object literal
  the module exports, and it fails loudly rather than silently subsetting to
  the wrong thing if that shape ever changes.
*/
const source = readFileSync("src/lib/brand/mono-subset.ts", "utf8");
const ranges = [...source.matchAll(/from:\s*(0x[0-9a-f]+),\s*to:\s*(0x[0-9a-f]+)/gi)].map(
  ([, from, to]) => [Number(from), Number(to)]
);

if (ranges.length === 0) {
  throw new Error(
    "No ranges found in src/lib/brand/mono-subset.ts. Has MONO_SUBSET_RANGES changed shape?"
  );
}

// Only the lower bound carries the U+ prefix: pyftsubset reads "U+2581-2588"
// and fails to parse "U+2581-U+2588".
const hex = (n) => n.toString(16).toUpperCase().padStart(4, "0");
const unicodes = ranges
  .map(([from, to]) => (from === to ? `U+${hex(from)}` : `U+${hex(from)}-${hex(to)}`))
  .join(",");

console.log(`Subsetting ${ranges.length} ranges into ${OUTPUT}`);

execFileSync(
  "pyftsubset",
  [
    SOURCE,
    `--output-file=${OUTPUT}`,
    "--flavor=woff2",
    `--unicodes=${unicodes}`,
    "--layout-features=*",
    "--no-hinting",
    "--desubroutinize",
  ],
  { stdio: "inherit" }
);

console.log("Done. Check the size, and run the tests: they know what has to be in it.");
