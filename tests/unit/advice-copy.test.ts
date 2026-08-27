import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/*
  Arena is a game. Buy and Sell on the Trade room are the game.

  What it must not do is the thing Lab's Pulse copy used to do: point at a
  named company and tell somebody what to do with it. A day's move that opens
  a buy ticket is that, whatever the sentence above the tiles claims.

  Two checks. One pins the surface that actually did it. The other walks
  reader-facing copy for the orders Lab had to scrub, so they cannot arrive
  here as a "helpful" line on a card.
*/

const BANNED: { name: string; pattern: RegExp }[] = [
  { name: "sit tight", pattern: /\bsit tight\b/i },
  { name: "start small", pattern: /\bstart small\b/i },
  { name: "good time to", pattern: /\bgood time to\b/i },
  { name: "you should buy/sell/hold", pattern: /\byou should (buy|sell|hold)\b/i },
  { name: "consider buying/selling", pattern: /\bconsider (buying|selling|holding)\b/i },
  { name: "smart move", pattern: /\bsmart move\b/i },
  { name: "fits here", pattern: /\bfits here\b/i },
  { name: "buy now", pattern: /\bbuy now\b/i },
  { name: "sell everything", pattern: /\bsell everything\b/i },
  { name: "add to portfolio", pattern: /\badd to (your )?portfolio\b/i },
  { name: "looks cheap", pattern: /\blooks cheap\b/i },
  { name: "looks expensive", pattern: /\blooks expensive\b/i },
  { name: "overbought", pattern: /\boverbought\b/i },
  { name: "oversold", pattern: /\boversold\b/i },
];

function stripTrailingComment(line: string): string {
  let quote: string | null = null;
  for (let i = 0; i < line.length; i += 1) {
    const c = line[i]!;
    if (quote) {
      if (c === "\\") i += 1;
      else if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      quote = c;
      continue;
    }
    if (c === "/" && line[i + 1] === "/") return line.slice(0, i);
  }
  return line;
}

function readerFacingLines(file: string): { line: number; text: string }[] {
  const out: { line: number; text: string }[] = [];
  let inBlock = false;
  readFileSync(file, "utf8")
    .split("\n")
    .forEach((raw, i) => {
      const t = raw.trim();
      if (inBlock) {
        if (t.includes("*/")) inBlock = false;
        return;
      }
      if (t.startsWith("/*") || t.startsWith("{/*")) {
        if (!t.includes("*/")) inBlock = true;
        return;
      }
      if (t.startsWith("//") || t.startsWith("*")) return;
      out.push({ line: i + 1, text: stripTrailingComment(raw) });
    });
  return out;
}

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...sourceFiles(full));
    } else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

describe("what moved today is news, not a ticket", () => {
  const movers = readFileSync("src/components/Movers.tsx", "utf8");
  const tradeForm = readFileSync("src/components/TradeForm.tsx", "utf8");
  const tradePage = readFileSync("src/app/(app)/trade/page.tsx", "utf8");

  it("does not open a buy form for a named company", () => {
    expect(movers).not.toMatch(/\/trade\?symbol=/);
    expect(movers).not.toMatch(/<Link\b/);
    expect(movers).not.toMatch(/\bhref=\{?["'`]\/trade/);
  });

  it("does not pre-fill the trade form from a URL", () => {
    expect(tradeForm).not.toMatch(/\binitialSymbol\b/);
    expect(tradePage).not.toMatch(/\bpickedFrom\b/);
    expect(tradePage).not.toMatch(/\binitialSymbol\b/);
    expect(tradePage).not.toMatch(/\bsearchParams\b/);
  });
});

describe("reader-facing copy is not an order", () => {
  const files = sourceFiles("src");

  it("finds the tree it is supposed to be checking", () => {
    expect(files.length).toBeGreaterThan(100);
    expect(files).toContain("src/components/Movers.tsx");
    expect(files).toContain("src/lib/tour-steps.ts");
  });

  it("has none of the orders Lab had to scrub", () => {
    const bad = files.flatMap((file) =>
      readerFacingLines(file).flatMap((line) =>
        BANNED.filter((rule) => rule.pattern.test(line.text)).map(
          (rule) => `${file}:${line.line} (${rule.name}): ${line.text.trim()}`
        )
      )
    );
    expect(bad).toEqual([]);
  });
});
