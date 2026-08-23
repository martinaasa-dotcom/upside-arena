import { describe, expect, it } from "vitest";
import {
  headline,
  ordinal,
  shareText,
  sparkline,
  versusMarketLine,
  weekLabel,
  type Recap,
} from "@/lib/share/card";

/*
  The share card is the whole growth loop, and it lives or dies on one thing:
  being worth posting after a bad week as well as a good one. These tests hold
  that line, and hold the row of blocks readable, because the text version is
  what travels into chats where no image or link preview ever arrives.
*/

const base: Recap = {
  displayName: "Nina",
  title: null,
  monday: "2026-08-17",
  returnPercent: 4.2,
  benchmarkReturn: 1.1,
  benchmarkDiff: 3.1,
  league: { name: "Friday Club", rank: 2, size: 6 },
  streakDays: 8,
  marks: [1.0, 2.5, -1.0, 3.4, 4.2],
};

describe("the shape of a week", () => {
  it("draws one block per trading day", () => {
    expect(sparkline([1, 2, 3, 4, 5])).toHaveLength(5);
  });

  it("puts the worst day at the bottom and the best at the top", () => {
    const row = sparkline([1.0, 2.5, -1.0, 3.4, 4.2]);
    expect(row[2]).toBe("▁");
    expect(row[4]).toBe("█");
  });

  it("scales to the week's own range, so a quiet week still has a shape", () => {
    // Half a percent of movement is a real week. Flattening it to five
    // identical blocks would throw away the only interesting thing in it.
    const row = sparkline([0.1, 0.2, 0.15, 0.4, 0.3]);
    expect(new Set(row.split("")).size).toBeGreaterThan(1);
  });

  it("draws a genuinely flat week level, not at rock bottom", () => {
    // Every day identical. The lowest block would read as a terrible week
    // that never happened.
    const row = sparkline([2, 2, 2, 2, 2]);
    expect(new Set(row.split("")).size).toBe(1);
    expect(row).not.toContain("▁");
  });

  it("says nothing at all when there are no marks", () => {
    // Weeks played before marks were recorded have no shape, and inventing
    // one would be inventing data.
    expect(sparkline([])).toBe("");
  });

  it("handles a week that only ran a few days", () => {
    expect(sparkline([1, -1])).toHaveLength(2);
  });
});

describe("saying how it went against the market", () => {
  it("calls a small gap level rather than splitting hairs", () => {
    expect(versusMarketLine(0.01)).toBe("Level with the market");
    expect(versusMarketLine(-0.02)).toBe("Level with the market");
  });

  it("never puts a sign in front of a word that already says the direction", () => {
    // "+3.1% ahead" and "-3.1% behind" both read wrongly.
    expect(versusMarketLine(3.1)).toBe("3.1% ahead of the market");
    expect(versusMarketLine(-3.1)).toBe("3.1% behind the market");
  });

  it("says nothing when the market has not been scored", () => {
    expect(versusMarketLine(null)).toBeNull();
  });
});

describe("ordinals", () => {
  it("gets the ordinary ones right", () => {
    expect(ordinal(1)).toBe("1st");
    expect(ordinal(2)).toBe("2nd");
    expect(ordinal(3)).toBe("3rd");
    expect(ordinal(4)).toBe("4th");
    expect(ordinal(21)).toBe("21st");
  });

  it("gets the teens right, which is where this is always got wrong", () => {
    expect(ordinal(11)).toBe("11th");
    expect(ordinal(12)).toBe("12th");
    expect(ordinal(13)).toBe("13th");
    expect(ordinal(111)).toBe("111th");
  });
});

describe("the week label", () => {
  it("spells the month out, because a pasted line has no context", () => {
    expect(weekLabel("2026-08-17")).toBe("17 August");
  });

  it("does not drift a day either side of the date", () => {
    // Parsed at midday UTC on purpose. Midnight would land on the previous
    // day for anyone west of Greenwich.
    expect(weekLabel("2026-01-01")).toBe("1 January");
    expect(weekLabel("2026-12-31")).toBe("31 December");
  });

  it("says nothing rather than an Invalid Date when given nonsense", () => {
    expect(weekLabel("not-a-date")).toBe("");
  });
});

describe("the headline", () => {
  it("leads with beating the market, which is the thing worth saying", () => {
    expect(headline(base)).toBe("Beat the market");
  });

  it("still leads with it when the market fell and they fell less", () => {
    // Down 1% while the market is down 3% is a good week, and the card has to
    // say so or nobody will ever post one.
    expect(
      headline({ ...base, returnPercent: -1, benchmarkReturn: -3, benchmarkDiff: 2 })
    ).toBe("Beat the market");
  });

  it("states a bad week plainly, without scolding", () => {
    const line = headline({
      ...base,
      returnPercent: -4.5,
      benchmarkReturn: 1,
      benchmarkDiff: -5.5,
    });

    expect(line).toBe("Finished down");
    expect(line.toLowerCase()).not.toContain("lost");
    expect(line.toLowerCase()).not.toContain("worse");
  });

  it("has something to say about a week that went nowhere", () => {
    expect(headline({ ...base, returnPercent: 0, benchmarkDiff: 0 })).toBe(
      "Finished level"
    );
  });
});

describe("the text somebody pastes", () => {
  const url = "https://upsidearena.com/w/abc123";

  it("carries the whole result without needing the link to open", () => {
    const text = shareText(base, url);

    expect(text).toContain("week of 17 August");
    expect(text).toContain("+4.2%");
    expect(text).toContain("3.1% ahead of the market");
    expect(text).toContain("2nd of 6 in Friday Club");
    expect(text).toContain("8 days in a row");
    expect(text).toContain(url);
  });

  it("includes the shape, which is what makes it worth pasting", () => {
    expect(shareText(base, url)).toContain(sparkline(base.marks));
  });

  it("leaves out a league when they are not in one", () => {
    const text = shareText({ ...base, league: null }, url);
    expect(text).not.toContain("Friday Club");
    expect(text).not.toContain("2nd");
    expect(text).toContain("+4.2%");
  });

  it("leaves out a streak of nothing rather than saying zero days", () => {
    const text = shareText({ ...base, streakDays: 0 }, url);
    expect(text).not.toContain("in a row");
  });

  it("says one day, not one days", () => {
    expect(shareText({ ...base, streakDays: 1 }, url)).toContain("1 day in a row");
  });

  it("is still worth posting after a bad week", () => {
    const text = shareText(
      {
        ...base,
        returnPercent: -6.3,
        benchmarkReturn: 1.2,
        benchmarkDiff: -7.5,
        league: { name: "Friday Club", rank: 6, size: 6 },
        marks: [-1, -3, -2, -5, -6.3],
      },
      url
    );

    // The facts, stated. No word in it tells them off for the week they had.
    expect(text).toContain("-6.3%");
    expect(text).toContain("7.5% behind the market");
    expect(text).toContain("6th of 6");
    for (const word of ["lost", "loser", "worst", "failed", "unlucky", "sorry"]) {
      expect(text.toLowerCase()).not.toContain(word);
    }
  });

  it("survives a week with no marks and no benchmark", () => {
    const text = shareText(
      { ...base, marks: [], benchmarkReturn: null, benchmarkDiff: null },
      url
    );

    expect(text).toContain("+4.2%");
    expect(text).not.toContain("market");
    expect(text.split("\n").every((line) => line !== undefined)).toBe(true);
  });

  it("puts the link last, on its own, so it is easy to strip", () => {
    const lines = shareText(base, url).split("\n");
    expect(lines[lines.length - 1]).toBe(url);
    expect(lines[lines.length - 2]).toBe("");
  });
});

describe("a week somebody joined halfway through", () => {
  /*
    The row has to keep its gaps. Dropping the days they were not here for
    slides Friday under Wednesday, which is the drawn card's old bug written
    out in characters -- and the row travels further than the card does,
    because it goes through plain text into places no image reaches.
  */
  it("keeps a place for every day, played or not", () => {
    expect(sparkline([null, null, 1, 2, 3])).toHaveLength(5);
    expect(sparkline([null, null, 1, 2, 3]).slice(0, 2)).toBe("  ");
  });

  it("scales against the days that happened, not against a nought", () => {
    // Three days that all went up. Scaled against an absent day read as
    // zero, the first of them would be the bottom of the range.
    const row = sparkline([null, null, 1, 2, 3]);
    expect(row[2]).not.toBe(row[4]);
    expect(row.trim().length).toBe(3);
  });

  it("draws a flat part-week flat rather than empty", () => {
    expect(sparkline([null, 2, 2, 2, null])).toBe(" \u2584\u2584\u2584 ");
  });

  it("has nothing to say about a week with no days in it at all", () => {
    expect(sparkline([null, null, null, null, null])).toBe("");
  });
});
