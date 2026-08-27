/**
 * Settings, menus and list actions stay on one row, control on the right.
 *
 * Ported from Lab. A stacked, left-aligned button under a sentence is how
 * the Account page spent a thumb-width of empty glass on the right and an
 * extra row of height. The classes are the whole rule, so they are checked
 * as source: a wrap coming back is a layout bug that every phone would
 * feel and no render test on a desktop viewport would catch.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const ROW = readFileSync("src/components/ui/setting-row.tsx", "utf8");
const ACCOUNT = readFileSync("src/components/AccountControls.tsx", "utf8");
const CONSENT = readFileSync("src/components/ConsentControl.tsx", "utf8");
const PANEL = readFileSync("src/components/Panel.tsx", "utf8");
const CSS = readFileSync("src/app/globals.css", "utf8");

const CONSUMERS = [
  "src/components/AccountControls.tsx",
  "src/components/ConsentControl.tsx",
  "src/components/NotificationSettings.tsx",
  "src/components/SignInAddresses.tsx",
  "src/components/CoinShop.tsx",
  "src/components/InviteCode.tsx",
  "src/components/SharedCards.tsx",
  "src/components/PlusControls.tsx",
  "src/components/FirstRun.tsx",
  "src/components/WeeklyGoal.tsx",
  "src/components/DraftCard.tsx",
  "src/components/BattleCard.tsx",
];

describe("setting rows do not wrap", () => {
  it("pins the control to the right on one row", () => {
    expect(ROW).toMatch(
      /SETTING_ROW\s*=\s*"flex flex-row flex-nowrap items-center justify-between gap-3"/
    );
    expect(ROW).toMatch(/SETTING_COPY\s*=\s*"min-w-0 flex-1"/);
    expect(ROW).toMatch(
      /SETTING_ACTIONS\s*=\s*"flex shrink-0 items-center justify-end gap-2"/
    );
  });

  it("puts a description under the row, never beside the control", () => {
    expect(ROW).toContain("SETTING_STACK");
    expect(ROW).toContain("export function SettingBar");
    expect(ROW).toMatch(/if \(description == null\) return bar/);
  });

  it("is what Account, consent and the panel header actually use", () => {
    expect(ACCOUNT).toContain("SettingBar");
    expect(ACCOUNT).not.toMatch(/flex-col items-start/);
    expect(CONSENT).toContain("SettingBar");
    expect(PANEL).toContain("SettingBar");
  });

  it("is the row primitive on every text-plus-button list", () => {
    for (const file of CONSUMERS) {
      const src = readFileSync(file, "utf8");
      expect(src, file).toMatch(/SettingBar|SETTING_ROW/);
    }
  });
});

describe("a right-aligned control stays off the iOS edge", () => {
  it("insets the page from the left and right safe areas", () => {
    expect(CSS).toMatch(/padding-left:\s*env\(safe-area-inset-left\)/);
    expect(CSS).toMatch(/padding-right:\s*env\(safe-area-inset-right\)/);
  });
});
