/*
  What the walkthrough says, apart from the component that shows it.

  Two things import this that are not the walkthrough: /gallery, which renders
  every screen so the clipping probe can measure it, and its unit test. Both
  are outside the client boundary, and a plain array exported from a
  "use client" module does not survive the crossing -- it arrives as a client
  reference, and `STEPS.map` is not a function. So the words live here and the
  component that draws them stays a client component.

  Nothing in this file is a figure typed out by hand. The starting balance,
  the lineup size, the season threshold, the notification cap and the rooms
  are all imported from what the game is played by, so the walkthrough cannot
  end up describing a game Arena stopped being. tests/unit/tour.test.ts holds
  it to that.
*/
import {
  BadgeCheck,
  Banknote,
  BellOff,
  BellRing,
  CalendarDays,
  CalendarRange,
  Clock,
  Home,
  Swords,
  Timer,
  TrendingDown,
  TrendingUp,
  Trophy,
  User,
  Wallet,
} from "lucide-react";
import { formatMoney } from "@/lib/format";
import { STARTING_BALANCE, MAX_LINEUP_ORDERS } from "@/lib/game";
import { MIN_WEEKS_TO_RANK } from "@/lib/game/season-rules";
import { DAILY_CAP, QUIET_HOURS } from "@/lib/notify/timing";
import { ROOMS } from "@/lib/rooms";

export type TourRow = {
  icon: React.ComponentType<{ className?: string }>;
  term: string;
  text: string;
};

export type Step = {
  /** The step label. Short: it shares a line with a count. */
  key: string;
  title: string;
  lede: string;
  rows?: TourRow[];
  note?: string;
};

/*
  `ROOMS` is the dock's own list, so the map is guaranteed to name the rooms
  that exist. Only the sentence about each one lives here, and
  tests/unit/tour.test.ts fails if a room is added without one.
*/
export const ROOM_BLURB: Record<string, string> = {
  "/home": "What you own, what it is worth, what moved today, and where your week stands against the market.",
  "/trade": "Buy and sell. Real companies, real prices, whole shares, no borrowing.",
  "/leagues": "Your leagues, the tables, the invite codes, weekly goals, and battles.",
  "/profile": "Every week you have played, your streak, what you have earned, the season table, and every switch.",
};

export const STEPS: Step[] = [
  {
    key: "Game",
    title: "Arena is a game, and the money is not real",
    lede: `You get ${formatMoney(
      STARTING_BALANCE
    )} of pretend money and buy shares in real companies at real prices. At the end of the week you find out how you did, against the market and against your friends.`,
    rows: [
      {
        icon: Wallet,
        term: "None of it is real money",
        text: "You cannot deposit, you cannot withdraw, and you cannot lose money you had. No stake, no payout.",
      },
      {
        icon: BadgeCheck,
        term: "It is free, and it stays free",
        text: "Nothing you can buy changes a result. Anything paid sits under Plus, in the top corner, and it is more leagues and things to wear next to your name.",
      },
    ],
  },
  {
    key: "Week",
    title: "The week is the whole game",
    lede: "Every Monday at 09:30 New York time everybody starts again with the same money. You buy and sell on weekdays between 09:30 and 16:00. At Friday's close the week is scored, and on Monday everybody is level again.",
    rows: [
      {
        icon: CalendarDays,
        term: "Nothing carries over",
        text: "Somebody who has played for a year starts Monday exactly level with somebody who signed up last night.",
      },
      {
        icon: Banknote,
        term: "Cash earns nothing",
        text: "Whole shares only, no borrowing, no leverage. Sitting in cash is a decision, not a safe place to hide.",
      },
    ],
  },
  {
    key: "Score",
    title: "The number that counts is the second one",
    lede: "Home shows what you made this week and how that compares to the market as a whole. The second one is the honest one.",
    rows: [
      {
        icon: TrendingUp,
        term: "Up is not the same as good",
        text: "Everybody is up in a week the market ran. Up 2% while the market was up 3% is a bad week that looks like a good one.",
      },
      {
        icon: TrendingDown,
        term: "A falling week is still worth playing",
        text: "Losing 1% while the market lost 4% is one of the better things you can do here, and the app says so.",
      },
    ],
  },
  {
    key: "Rooms",
    title: "Where everything is",
    lede: "Four things on the bar along the bottom, and the last one is your own face. Nothing is hidden behind a menu. Press and hold any of them and it tells you where it goes. The only room off the bar is Plus, in the top corner.",
    rows: ROOMS.map((room) => ({
      icon: room.icon,
      term: room.label,
      text: ROOM_BLURB[room.href] ?? "",
    })),
  },
  {
    key: "Leagues",
    title: "A league is where the game actually happens",
    lede: "Playing alone is a spreadsheet. Two people is a game. We have already made you a league of your own, so send its code to one person and you have a race.",
    rows: [
      {
        icon: Trophy,
        term: "Private, always",
        text: "Nobody can find your league and nobody joins it without the code. Inside it you see everybody's week and who is immediately ahead of you.",
      },
      {
        icon: Swords,
        term: "Battles",
        text: "A second contest beside the ordinary week, with its own rules: semiconductors only, one company at a time, pick the losers instead of the winners.",
      },
      {
        icon: CalendarRange,
        term: "Call your shot",
        text: "Once a week you can say what you are going for. It earns nothing. Saying it to people who will see whether you did is the point.",
      },
    ],
    note: "Everybody's holdings are opened to the league once a week is settled, never while it is running.",
  },
  {
    key: "Weekend",
    title: "The weekend is for deciding, not for waiting",
    lede: `The market shuts at 16:00 on Friday and opens at 09:30 on Monday, so there is nothing to miss in between. What you can do is line up next week: pick up to ${MAX_LINEUP_ORDERS} companies and they are bought for you at Monday's opening price.`,
    rows: [
      {
        icon: Clock,
        term: "No advantage in being early",
        text: "Everybody who leaves a lineup fills at the same opening price. It locks at the open, so nothing is ever placed with hindsight.",
      },
      {
        icon: Timer,
        term: "A minute a day, ten on a Sunday",
        text: "That is honestly the whole thing. Forget about it for a week and you have lost that week and nothing else.",
      },
    ],
  },
  {
    key: "Record",
    title: "What keeps going underneath",
    lede: "The week resets. These do not.",
    rows: [
      {
        icon: Home,
        term: "Your streak",
        text: "Days you opened Arena and looked at your week. Trading days only, so a weekend never breaks one, and it has nothing to do with how well you did.",
      },
      {
        icon: User,
        term: "Your record",
        text: "Every week you have played is on your profile: what you made, and how it compared to the market. Each was settled on the Friday it happened.",
      },
      {
        icon: CalendarRange,
        term: "The season",
        text: `A quarter of weeks, ranked on how far ahead of the market you finished per week rather than on total profit. Play ${MIN_WEEKS_TO_RANK} weeks of a quarter and you are placed in it.`,
      },
    ],
  },
  {
    key: "Notes",
    title: "What Arena will send you, and what it will not",
    lede: "Every message is something that actually happened, to you, with a name attached. Every one is a switch on your profile, and off means off that moment.",
    rows: [
      {
        icon: BellRing,
        term: "The cap",
        text: `Never more than ${DAILY_CAP} in a day, and never between ${QUIET_HOURS} where you are.`,
      },
      {
        icon: BellOff,
        term: "Never about a bad week",
        text: "No “come back”, no “your friends are playing without you”, no invented countdown. Messaging a loss as something one more trade could fix is not going to be built here.",
      },
    ],
    note: "Not a broker. Not real money. Not advice, and not a prediction. A week of picking winners with pretend money tells you very little about picking them with real money.",
  },
];
