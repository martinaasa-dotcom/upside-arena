/**
 * The root element declares no overflow, so a menu hung off the chrome
 * opens where the reader is looking.
 *
 * `html` carrying `overflow-x: clip` beside `body`'s reads as belt and
 * braces and is not. Setting either axis makes the root a scroll
 * container, and Floating UI, which positions every Radix dialog, popover
 * and tooltip in this app, asks exactly that question before it places
 * one: when the root is an overflow element it works in document
 * coordinates instead of viewport ones. For anything laid out in the page
 * the two agree and nothing looks wrong, which is why this survived so
 * long on Lab. For the chrome they do not agree at all, because the chrome
 * is the one thing that stays put while the page moves.
 *
 * Measured on Lab at 390x844, scrolled 186px down: a header menu opened at
 * viewport y -132 instead of 54, entirely above the top of the screen. It
 * was open, and focused, and invisible. Every menu anchored to the chrome
 * had it, and only while the page was scrolled, which is what made it look
 * intermittent.
 *
 * Arena's header is sticky and the dock is fixed, so the same coordinate
 * split is waiting if the declaration comes back. Asserted against the
 * source because the bug is one declaration in a stylesheet.
 *
 * Upside Lab has the same guard. Fix both or neither.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const CSS = readFileSync("src/app/globals.css", "utf8");

function ruleNamed(name: string): string {
  const stripped = CSS.replace(/\/\*[\s\S]*?\*\//g, "");
  const match = stripped.match(
    new RegExp(`(?:^|\\n)\\s*${name}\\s*\\{([\\s\\S]*?)\\n\\s*\\}`)
  );
  if (!match) throw new Error(`no ${name} rule in globals.css`);
  return match[1];
}

describe("root overflow", () => {
  it("declares no overflow on html", () => {
    expect(
      ruleNamed("html"),
      "an overflow on the root makes it a scroll container, and every popper anchored to the sticky or fixed chrome is then drawn one scroll offset above where it belongs"
    ).not.toMatch(/(^|\s)overflow(-x|-y)?\s*:/);
  });

  it("still clips sideways, on body", () => {
    expect(ruleNamed("body")).toMatch(/overflow-x\s*:\s*clip/);
  });
});
