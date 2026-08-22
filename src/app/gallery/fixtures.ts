import type { SeasonStanding } from "@/lib/game/seasons";
import type { Standing } from "@/lib/game/leagues";
import type { Streak } from "@/lib/game/streaks";
import type { Position } from "@/lib/game/portfolio";
import type { PodView } from "@/lib/game/pods";
import type { Recap } from "@/lib/share/card";

/*
  The awkward cases, on purpose.

  Every one of these is chosen to be the value that breaks a layout rather
  than the value that flatters it: the longest name somebody could actually
  register, the widest figure the formatters can produce, a subtitle under a
  name that already fills its row. A gallery built from tidy data measures
  nothing, because tidy data fits everywhere.
*/

/** As long as the profile form will accept. Nothing wider can reach a screen. */
const LONG_NAME = "Aleksandra Wiśniewska-Rodríguez";
const LONG_HANDLE = "aleksandra_wisniewska";

export const seasonStandings: SeasonStanding[] = [
  {
    userId: "s1",
    displayName: LONG_NAME,
    handle: LONG_HANDLE,
    avatarUrl: null,
    rank: 1,
    position: 1,
    weeksPlayed: 13,
    weeksAhead: 11,
    averageVersusMarket: 12.847,
    averageReturnPercent: 18.42,
    bestWeekReturn: 42.9,
    isYou: false,
    ranked: true,
  },
  {
    userId: "s2",
    displayName: "You",
    handle: "you",
    avatarUrl: null,
    rank: null,
    position: 2,
    // The unranked row: a name, and a subtitle under it saying how far off
    // being ranked they are. This is the row that a fixed height cropped.
    weeksPlayed: 2,
    weeksAhead: 1,
    averageVersusMarket: -0.4,
    averageReturnPercent: -1.2,
    bestWeekReturn: null,
    isYou: true,
    ranked: false,
  },
  {
    userId: "s3",
    displayName: "Bo",
    handle: null,
    avatarUrl: null,
    rank: 3,
    position: 3,
    weeksPlayed: 13,
    weeksAhead: 0,
    averageVersusMarket: -104.5,
    averageReturnPercent: -99.9,
    bestWeekReturn: 0,
    isYou: false,
    ranked: true,
  },
];

export const leagueStandings: Standing[] = [
  {
    userId: "l1",
    displayName: LONG_NAME,
    handle: LONG_HANDLE,
    avatarUrl: null,
    rank: 1,
    totalValue: 1_284_913.55,
    returnPercent: 128.49,
    versusMarket: 121.4,
    isYou: false,
    hasTraded: true,
  },
  {
    userId: "l2",
    displayName: "You",
    handle: "you",
    avatarUrl: null,
    rank: 2,
    totalValue: 100_000,
    returnPercent: 0,
    versusMarket: null,
    isYou: true,
    hasTraded: false,
  },
];

/** A goal under a name, which is the second line a fixed-height row cropped. */
export function goalFor(userId: string) {
  return userId === "l1"
    ? { label: "Beat the market by 5% without selling anything", met: null }
    : null;
}

export const streak: Streak = {
  current: 6,
  longest: 41,
  lastActive: "2026-08-21",
  freezesAvailable: 2,
  freezesUsed: 1,
  countedToday: false,
  toNextMilestone: 1,
  nextMilestone: { id: "week", name: "Seven days running", at: 7 },
  toNextBonus: 1,
  nextBonusHasDrop: true,
};

export const streakDone: Streak = {
  ...streak,
  countedToday: true,
  current: 100,
  longest: 100,
  toNextMilestone: null,
  nextMilestone: null,
  freezesAvailable: 0,
};

export const positions: Position[] = [
  {
    symbol: "GOOGL",
    quantity: 1234.5678,
    costBasis: 98_765.43,
    averageCost: 80.01,
    quote: null,
    value: 123_456.78,
    gain: 24_691.35,
    gainPercent: 25.0,
  },
  {
    symbol: "BRK.B",
    quantity: 0.0001,
    costBasis: 1_000_000,
    averageCost: 999_999.99,
    quote: null,
    value: 0.01,
    gain: -999_999.99,
    gainPercent: -99.99,
  },
];

export const podView: PodView = {
  pod: { id: "p1", tier: "bronze", number: 3, name: "Bronze pod 3" },
  moving: 2,
  toPromotion: 1.4,
  toSafety: null,
  standings: [
    { userId: "p1", displayName: LONG_NAME, handle: LONG_HANDLE, avatarUrl: null, rank: 1, returnPercent: 5.2, versusMarket: 4.1, isYou: false, hasTraded: true },
    { userId: "p2", displayName: "Marcus", handle: "m", avatarUrl: null, rank: 2, returnPercent: 4.3, versusMarket: 3.2, isYou: false, hasTraded: true },
    { userId: "p3", displayName: "You", handle: "you", avatarUrl: null, rank: 3, returnPercent: 1.6, versusMarket: 0.5, isYou: true, hasTraded: true },
    { userId: "p4", displayName: "Tom", handle: "t", avatarUrl: null, rank: 4, returnPercent: -0.2, versusMarket: -1.3, isYou: false, hasTraded: true },
    { userId: "p5", displayName: "Ines", handle: "i", avatarUrl: null, rank: 5, returnPercent: -1.1, versusMarket: -2.2, isYou: false, hasTraded: true },
    { userId: "p6", displayName: "Raj", handle: "r", avatarUrl: null, rank: 6, returnPercent: -3.8, versusMarket: -4.9, isYou: false, hasTraded: false },
    { userId: "p7", displayName: "Mia", handle: "mi", avatarUrl: null, rank: 7, returnPercent: -4.7, versusMarket: -5.8, isYou: false, hasTraded: false },
    { userId: "p8", displayName: "Lena", handle: "l", avatarUrl: null, rank: 8, returnPercent: -9.9, versusMarket: -11.0, isYou: false, hasTraded: false },
  ],
};

/** The same pod seen from the bottom, where the drop warning has to win. */
export const podViewDropping: PodView = {
  ...podView,
  toPromotion: 6.3,
  toSafety: 2.7,
  standings: podView.standings.map((row) => ({
    ...row,
    isYou: row.userId === "p7",
  })),
};

export const recap: Recap = {
  displayName: LONG_NAME,
  title: "Seven days running",
  monday: "2026-08-17",
  returnPercent: 8.42,
  benchmarkReturn: 1.1,
  benchmarkDiff: 7.32,
  league: { name: "The Wednesday Afternoon Investment Society", rank: 1, size: 24 },
  streakDays: 41,
  marks: [1.2, -0.4, 3.9, 0.1, 3.6],
};
