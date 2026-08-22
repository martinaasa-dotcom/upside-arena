import type { SeasonStanding } from "@/lib/game/seasons";
import type { Standing } from "@/lib/game/leagues";
import type { Streak } from "@/lib/game/streaks";
import type { Position } from "@/lib/game/portfolio";
import type { PodView } from "@/lib/game/pods";
import type { Recap } from "@/lib/share/card";
import type { Battle } from "@/lib/game/battles";
import type { LineupView } from "@/lib/game/lineup";
import { formatById } from "@/lib/game/formats";
import { lengthById } from "@/lib/game/lengths";

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

type Row = PodView["standings"][number];

function podRow(
  id: string,
  displayName: string,
  rank: number,
  returnPercent: number,
  extra: Partial<Row> = {}
): Row {
  return {
    userId: id,
    displayName,
    handle: displayName.slice(0, 4).toLowerCase(),
    avatarUrl: null,
    rank,
    returnPercent,
    versusMarket: returnPercent - 1.1,
    isYou: false,
    hasTraded: true,
    outcome: null,
    ...extra,
  };
}

export const podView: PodView = {
  pod: { id: "p1", tier: "bronze", number: 3, name: "Bronze pod 3" },
  settled: false,
  moving: 2,
  toPromotion: 1.4,
  toSafety: null,
  standings: [
    podRow("p1", LONG_NAME, 1, 5.2, { handle: LONG_HANDLE }),
    podRow("p2", "Marcus", 2, 4.3),
    podRow("p3", "You", 3, 1.6, { isYou: true }),
    podRow("p4", "Tom", 4, -0.2),
    podRow("p5", "Ines", 5, -1.1),
    podRow("p6", "Raj", 6, -3.8, { hasTraded: false }),
    podRow("p7", "Mia", 7, -4.7, { hasTraded: false }),
    podRow("p8", "Lena", 8, -9.9, { hasTraded: false }),
  ],
};

/** The same pod seen from the bottom, where the drop warning has to win. */
export const podViewDropping: PodView = {
  ...podView,
  toPromotion: 6.3,
  toSafety: 2.7,
  standings: podView.standings.map((row) => ({
    ...row,
    displayName: row.userId === "p7" ? "You" : row.displayName,
    isYou: row.userId === "p7",
  })),
};

/*
  And the week after it finished, which is what somebody sees when they open
  the message that told them they moved. No gap to close, and the arrows are
  what the ladder wrote down rather than what this screen would work out.
*/
export const podViewSettled: PodView = {
  ...podView,
  settled: true,
  toPromotion: null,
  toSafety: null,
  standings: podView.standings.map((row) => ({
    ...row,
    outcome:
      row.rank <= 2 ? "promoted" : row.rank >= 7 ? "relegated" : ("held" as const),
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

/*
  The rest of the rooms.

  Everything below lays out text or figures somebody else supplied, which is
  the only thing that qualifies a component for this page. Every string is the
  longest plausible one rather than a tidy one: the league somebody actually
  names, the goal somebody actually declares, a balance with seven digits in
  it. A gallery of short strings measures nothing.
*/

/** As long as the create-league form will accept. */
export const LONG_LEAGUE = "The Wednesday Afternoon Investment Society";

export const sharedCards = [
  { id: "s1", url: "https://upsidearena.com/w/aB3dEf9h", monday: "2026-08-17", returnPercent: 12.4 },
  { id: "s2", url: "https://upsidearena.com/w/zZ9yXw8v", monday: "2026-08-10", returnPercent: -8.9 },
  { id: "s3", url: "https://upsidearena.com/w/qQ1rTy2u", monday: "2026-08-03", returnPercent: 0 },
];

export const notificationSettings = {
  push: true,
  email: false,
  rivalAlerts: true,
  weekResult: true,
  streakReminder: false,
  timezone: "Europe/Tallinn",
};

/** Five days that were not all the same, so the shape is a shape. */
export const weekMarks = [1.2, -0.4, 3.9, 0.1, -2.6];

/** And a week that barely moved, which has to stay readable as flat. */
export const flatMarks = [0.01, 0.0, 0.01, 0.0, 0.01];

/*
  A battle, in the shape that is hardest to lay out: the longest format name
  against the longest league name, with the "runs through the weekend" line
  that only one format shows.
*/
export const battle: Battle = {
  cycleId: "b1",
  leagueId: "l1",
  leagueName: LONG_LEAGUE,
  leagueIcon: "\u{1F3C6}",
  format: formatById("crypto"),
  length: lengthById("quarter"),
  startsOn: "2026-08-17",
  endsOn: "2026-11-13",
  status: "open",
  finished: false,
  startingBalance: 100_000,
  benchmarkSymbol: "BTC-USD",
  benchmarkOpen: 61_240.5,
  benchmarkClose: null,
  isYours: true,
  timeLeft: "About 3 months left",
  notStarted: false,
};

export const battleFinished: Battle = {
  ...battle,
  format: formatById("inverse"),
  length: lengthById("week"),
  benchmarkSymbol: "SH",
  status: "closed",
  finished: true,
  benchmarkClose: 25.4,
  timeLeft: "Finished",
};

/*
  A lineup with one of everything: a name that could not be priced, a whole
  number of shares wide enough to fill its column, and a company name long
  enough to need the row to truncate rather than wrap.
*/
export const lineup: LineupView = {
  monday: "2026-08-24",
  locked: false,
  maxOrders: 8,
  startingBalance: 100_000,
  estimate: 61_450,
  orders: [
    {
      id: "o1",
      symbol: "GOOGL",
      quantity: 120,
      name: "Alphabet Inc. Class A Capital Stock",
      estimate: 24_600,
      quote: null,
      ran: false,
      outcome: null,
      fillPrice: null,
      detail: null,
    },
    {
      id: "o2",
      symbol: "BRK-B",
      quantity: 1_250,
      name: "Berkshire Hathaway Inc. New Class B Common Stock",
      estimate: 36_850,
      quote: null,
      ran: false,
      outcome: null,
      fillPrice: null,
      detail: null,
    },
    {
      id: "o3",
      symbol: "NOPRICE",
      quantity: 4,
      name: null,
      estimate: null,
      quote: null,
      ran: false,
      outcome: null,
      fillPrice: null,
      detail: null,
    },
  ],
};

export const lineupLocked: LineupView = { ...lineup, locked: true };

/** The longest reason a lineup order can give for not having run. */
export const lineupMissed = [
  {
    symbol: "BRK-B",
    detail:
      "There was not enough cash left by the time this one came round, so nothing was bought.",
  },
];
