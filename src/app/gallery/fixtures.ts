import type { SeasonStanding } from "@/lib/game/seasons";
import type { Standing } from "@/lib/game/leagues";
import type { Streak } from "@/lib/game/streaks";
import type { Position } from "@/lib/game/portfolio";
import type { Quote } from "@/lib/market/quotes";
import type { PodView } from "@/lib/game/pods";
import type { Recap } from "@/lib/share/card";
import type { Battle } from "@/lib/game/battles";
import type { DraftSeat, DraftShell, DraftState } from "@/lib/game/draft";
import type { DraftRow } from "@/lib/supabase/database.types";
import type { LineupView } from "@/lib/game/lineup";
import type { HeadToHead, Honour, PlayedWeek, RecordedWeek } from "@/lib/game/record";
import type { MoversView } from "@/lib/market/movers";
import { formatById } from "@/lib/game/formats";
import { lengthById } from "@/lib/game/lengths";
import { cadenceById } from "@/lib/game/cadence";

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
    todayPercent: 0.9,
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
    todayPercent: -1.4,
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

/*
  A quote as the app actually holds one. Fixed, because a fixture whose
  numbers move is a photograph that cannot be compared with yesterday's.
*/
function quoteFor(symbol: string, name: string, price: number): Quote {
  return {
    symbol,
    price,
    previousClose: price,
    change: 0,
    changePercent: 0,
    currency: "USD",
    marketState: "REGULAR",
    name,
    type: "EQUITY",
    fetchedAt: 0,
    stale: false,
  };
}

export const positions: Position[] = [
  /*
    A position with a price and a name, which is what almost every row in
    this panel is and which none of them was here.

    Both fixtures below carry no quote, deliberately, to check the row that
    has no price. The consequence was that the name column -- the one the
    comment in Holdings describes tuning the whole layout around, because it
    is the thing allowed to truncate -- was empty in every photograph ever
    taken of this component.
  */
  {
    symbol: "NVDA",
    quantity: 210,
    costBasis: 62_000,
    averageCost: 295.24,
    quote: quoteFor("NVDA", "NVIDIA Corporation", 341.2),
    value: 71_652,
    gain: 9_652,
    gainPercent: 15.57,
  },
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
  The two weeks the card was actually designed for.

  card.ts opens by saying the whole share loop rests on one requirement: the
  card has to be worth posting after a bad week too, because nobody shares
  something that makes them look foolish. Until now the only week ever
  photographed was up eight per cent, first of twenty-four, on a forty-one
  day streak -- the version that needs no design at all.

  One is down and still ahead of a market that fell further, which is a good
  week wearing a minus sign and is the case the wording exists for. The other
  is down and behind, which is simply a bad week, and it has to read as
  neither a scolding nor a consolation prize.
*/
export const recapAheadOfFallingMarket: Recap = {
  displayName: "Priya",
  title: null,
  monday: "2026-08-17",
  returnPercent: -1.4,
  benchmarkReturn: -4.9,
  benchmarkDiff: 3.5,
  league: { name: "The Pit", rank: 2, size: 6 },
  streakDays: 3,
  marks: [-0.2, -2.6, -1.9, -3.1, -1.4],
};

export const recapBadWeek: Recap = {
  displayName: "Marcus",
  title: null,
  monday: "2026-08-17",
  returnPercent: -6.2,
  benchmarkReturn: 1.8,
  benchmarkDiff: -8.0,
  league: { name: "The Pit", rank: 6, size: 6 },
  streakDays: 0,
  marks: [1.1, -0.4, -3.8, -5.2, -6.2],
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
  leagueActivity: true,
  timezone: "Europe/Tallinn",
};

/** Five days that were not all the same, so the shape is a shape. */
export const weekMarks = [1.2, -0.4, 3.9, 0.1, -2.6];

/** And a week that barely moved, which has to stay readable as flat. */
export const flatMarks = [0.01, 0.0, 0.01, 0.0, 0.01];

/*
  A week in the middle of itself: two closes in the book, today still moving,
  and the rest of the week not there yet. The dates are a real Monday and the
  two days after it, because weekSoFar places a mark by its date and not by
  its position.
*/
/*
  A week somebody joined on the Wednesday of. Two empty days that have to keep
  their places, because the alternative is a card that says they played the
  Monday.
*/
export const joinedMidweekMarks = [null, null, 1.2, 2.8, 0.4];

/*
  A quarter that went somewhere and came back, which is the run the single
  figure at the top of the screen cannot tell from a steady climb. Sixty-five
  closes, which is what a quarter of trading days actually is.
*/
/*
  A settled battle's books. One concentrated winner, one spread-out second,
  and somebody who never traded at all -- which is a way of playing it, and
  on a week the market fell it is a winning one.
*/
/*
  The same table with no day in it, which is what a battle looks like -- and
  what every league looks like on a Monday and at the weekend. A separate
  fixture because it is a different branch of the row: with no day to give
  the place up to, the money comes back onto the phone.
*/
export const battleStandings: Standing[] = leagueStandings.map((row) => ({
  ...row,
  todayPercent: null,
}));

export const revealedBooks = [
  {
    userId: "r1",
    displayName: LONG_NAME,
    rank: 1,
    returnPercent: 12.4,
    cash: 2100,
    traded: true,
    positions: [
      { symbol: "NVDA", quantity: 210, costBasis: 62_000 },
      { symbol: "AVGO", quantity: 96, costBasis: 24_500 },
      { symbol: "AMD", quantity: 80, costBasis: 11_400 },
    ],
  },
  {
    userId: "r2",
    displayName: "You",
    rank: 2,
    returnPercent: 3.1,
    cash: 41_000,
    traded: true,
    positions: [
      { symbol: "MU", quantity: 300, costBasis: 31_000 },
      { symbol: "TSM", quantity: 120, costBasis: 28_000 },
    ],
  },
  {
    userId: "r3",
    displayName: "Priya",
    rank: 3,
    returnPercent: 1.8,
    cash: 101_800,
    traded: true,
    positions: [],
  },
  {
    userId: "r4",
    displayName: "Marcus",
    rank: 4,
    returnPercent: 0,
    cash: 100_000,
    traded: false,
    positions: [],
  },
];

export const quarterTrail = Array.from({ length: 65 }, (_, day) => {
  const climb = Math.sin((day / 64) * Math.PI) * 18;
  const wobble = Math.sin(day * 1.7) * 1.4 + Math.sin(day * 0.6) * 0.9;
  return Number((climb + wobble - 2).toFixed(2));
});

/** The same length of run, spent behind the whole way. */
export const losingTrail = quarterTrail.map((value) => Number((-6 - value / 3).toFixed(2)));

export const partWeekMonday = "2026-08-17";
export const partWeekToday = "2026-08-19";
export const partWeekMarks = [
  { date: "2026-08-17", returnPercent: 1.2 },
  { date: "2026-08-18", returnPercent: -0.9 },
];
export const partWeekLive = 2.4;

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
  cadence: cadenceById("always"),
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
  drafted: false,
  buyingOpen: true,
  nextBuyDay: null,
  buyWindow: null,
};

/*
  A battle made at the weekend, which does not begin until the market next
  opens. The branch the card was getting wrong: it showed a countdown in the
  colour that means running, so on a Saturday it read as live.
*/
export const battleNotStarted: Battle = {
  ...battle,
  format: formatById("silicon"),
  length: lengthById("week"),
  benchmarkSymbol: "SOXX",
  startsOn: "2026-08-24",
  endsOn: "2026-08-28",
  timeLeft: "Ends in 6 days",
  notStarted: true,
  buyingOpen: false,
  nextBuyDay: "2026-08-24",
  buyWindow: null,
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
  buyingOpen: false,
  nextBuyDay: null,
  buyWindow: null,
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

/*
  A league's record, with the two shapes that break it: somebody who did not
  play a week at all, and a week nobody in the league was scored in.
*/
export const recordedWeeks: RecordedWeek[] = [
  {
    cycleId: "w1",
    monday: "2026-08-17",
    players: 6,
    benchmarkReturn: -1.35,
    winner: { userId: "s1", displayName: LONG_NAME, returnPercent: 12.4 },
    you: { rank: 4, returnPercent: -2.1, versusMarket: -0.75 },
  },
  {
    cycleId: "w2",
    monday: "2026-08-10",
    players: 6,
    benchmarkReturn: 0.9,
    winner: { userId: "you", displayName: "You", returnPercent: 6.8 },
    you: { rank: 1, returnPercent: 6.8, versusMarket: 5.9 },
  },
  {
    cycleId: "w3",
    monday: "2026-08-03",
    players: 5,
    benchmarkReturn: 2.4,
    winner: { userId: "s2", displayName: "Bo", returnPercent: 3.1 },
    you: null,
  },
  {
    cycleId: "w4",
    monday: "2026-07-27",
    players: 5,
    benchmarkReturn: null,
    winner: { userId: "s2", displayName: "Bo", returnPercent: 128.5 },
    you: { rank: 2, returnPercent: 0.04, versusMarket: null },
  },
  {
    cycleId: "w5",
    monday: "2026-07-20",
    players: 4,
    benchmarkReturn: -0.2,
    winner: { userId: "you", displayName: "You", returnPercent: 1.2 },
    you: { rank: 1, returnPercent: 1.2, versusMarket: 1.4 },
  },
];

export const honours: Honour[] = [
  {
    userId: "s1",
    displayName: LONG_NAME,
    handle: LONG_HANDLE,
    wins: 14,
    weeks: 31,
    weeksAhead: 19,
    averageVersusMarket: 2.41,
    bestWeek: 128.5,
    isYou: false,
  },
  {
    userId: "you",
    displayName: "You",
    handle: "you",
    wins: 2,
    weeks: 31,
    weeksAhead: 12,
    averageVersusMarket: -0.36,
    bestWeek: 6.8,
    isYou: true,
  },
  {
    userId: "s3",
    displayName: "Bo",
    handle: "bo",
    wins: 0,
    weeks: 1,
    weeksAhead: 0,
    averageVersusMarket: -14.2,
    bestWeek: null,
    isYou: false,
  },
];

export const headToHead: HeadToHead[] = [
  { userId: "s1", displayName: LONG_NAME, won: 9, lost: 21, together: 30 },
  { userId: "s2", displayName: "Bo", won: 4, lost: 4, together: 9 },
  { userId: "s3", displayName: "Priya", won: 1, lost: 0, together: 1 },
];

/*
  What moved, with the two rows that break it: a company name long enough to
  need truncating, and a move wide enough to sit next to it on a 320px phone.
*/
export const movers: MoversView = {
  up: [
    { symbol: "NVDA", name: "NVIDIA Corporation", price: 1284.55, changePercent: 12.42, owned: true },
    { symbol: "GOOGL", name: "Alphabet Inc. Class A", price: 204.1, changePercent: 3.8, owned: false },
    { symbol: "BRK-B", name: "Berkshire Hathaway Inc. New", price: 486.22, changePercent: 1.05, owned: false },
    { symbol: "F", name: "Ford Motor Company", price: 11.4, changePercent: 0.04, owned: false },
  ],
  down: [
    { symbol: "TSLA", name: "Tesla, Inc.", price: 198.4, changePercent: -128.5, owned: true },
    { symbol: "COIN", name: "Coinbase Global, Inc.", price: 240.15, changePercent: -6.2, owned: false },
    { symbol: "PLTR", name: "Palantir Technologies Inc.", price: 71.05, changePercent: -2.1, owned: false },
    { symbol: "DIS", name: "The Walt Disney Company", price: 96.8, changePercent: -0.11, owned: false },
  ],
};

/** A player's own weeks, including one the market was never recorded for. */
export const playedWeeks: PlayedWeek[] = [
  { cycleId: "p1", monday: "2026-08-17", returnPercent: 9.42, versusMarket: 10.77, finalValue: 109_420 },
  { cycleId: "p2", monday: "2026-08-10", returnPercent: -3.1, versusMarket: -4.0, finalValue: 96_900 },
  { cycleId: "p3", monday: "2026-08-03", returnPercent: 0.0, versusMarket: null, finalValue: 100_000 },
  { cycleId: "p4", monday: "2026-07-27", returnPercent: -128.5, versusMarket: -129.4, finalValue: 0 },
];

/*
  Draft night, in the shape that is hardest to lay out.

  Twenty-four names on the board, so a phone gets the full grid; the longest
  company names Yahoo actually returns for them, because "Advanced Micro
  Devices, Inc." under a cashtag and a price is what decides whether a tile
  crops; and a running order deep enough to scroll.
*/
const SILICON = formatById("silicon");

export const draftShell: DraftShell = {
  id: "d1",
  cycleId: "b1",
  leagueId: "l1",
  leagueName: LONG_LEAGUE,
  format: SILICON,
  length: lengthById("week"),
  rounds: 3,
  pickSeconds: 60,
  startsOn: "2026-08-31",
  endsOn: "2026-09-04",
  budget: 33_333.33,
  board: (SILICON.universe.kind === "list" ? SILICON.universe.symbols : []).map(
    (symbol, index) => ({
      symbol,
      name:
        index === 1
          ? "Advanced Micro Devices, Inc."
          : index === 3
            ? "Taiwan Semiconductor Manufacturing Company Limited"
            : `${symbol} Corporation`,
      price: 100 + index * 37.5,
    })
  ),
  isOpener: true,
};

const DRAFT_SEATS: DraftSeat[] = [
  { userId: "u1", name: "You", seat: 0, isYou: true },
  { userId: "u2", name: "Rasmus Marjapuu", seat: 1, isYou: false },
  { userId: "u3", name: "Karoliine", seat: 2, isYou: false },
  { userId: "u4", name: "Amanda", seat: 3, isYou: false },
];

/** Mid-draft: five names gone, the sixth turn live and it is somebody else's. */
export const draftState: DraftState = {
  now: 0,
  status: "picking",
  currentPick: 5,
  totalPicks: 12,
  deadline: null,
  seats: DRAFT_SEATS,
  taken: {
    NVDA: { userId: "u1", name: "You" },
    AMD: { userId: "u2", name: "Rasmus Marjapuu" },
    TSM: { userId: "u3", name: "Karoliine" },
    AVGO: { userId: "u4", name: "Amanda" },
    QCOM: { userId: "u4", name: "Amanda" },
  },
  turns: Array.from({ length: 12 }, (_, pick) => {
    const seat = Math.floor(pick / 4) % 2 === 0 ? pick % 4 : 3 - (pick % 4);
    const who = DRAFT_SEATS[seat];
    const taken = ["NVDA", "AMD", "TSM", "AVGO", "QCOM"][pick] ?? null;
    return {
      pickNumber: pick,
      userId: who.userId,
      name: who.name,
      isYou: who.isYou,
      round: Math.floor(pick / 4) + 1,
      symbol: taken,
      byClock: pick === 4,
      outcome: null,
      shares: null,
      fillPrice: null,
      detail: null,
    };
  }),
  onTheClock: DRAFT_SEATS[2],
  yourTurnsAway: 2,
  youAreSeated: true,
};

/** The lobby, before any seat has a number. */
export const draftLobby: DraftState = {
  ...draftState,
  status: "waiting",
  currentPick: 0,
  turns: [],
  taken: {},
  onTheClock: null,
  yourTurnsAway: null,
  seats: DRAFT_SEATS.map((seat) => ({ ...seat, seat: null })),
};

/** The draft as the league page shows it while it is being picked. */
export const draftRow: DraftRow = {
  id: "d1",
  cycle_id: "b1",
  league_id: "l1",
  status: "picking",
  rounds: 3,
  pick_seconds: 60,
  current_pick: 5,
  deadline: null,
  created_by: "u1",
  created_at: "2026-08-30T19:00:00Z",
  started_at: "2026-08-30T19:05:00Z",
  picked_at: null,
  filled_at: null,
};

/** The same, before anybody has picked. */
export const draftRowWaiting: DraftRow = {
  ...draftRow,
  status: "waiting",
  current_pick: 0,
  started_at: null,
};
