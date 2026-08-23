"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import {
  BellRing,
  CalendarRange,
  Home,
  Swords,
  Trophy,
  User,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { finishTour } from "@/app/(app)/actions";
import { CARD } from "@/lib/page-shell";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/format";
import { STARTING_BALANCE, MAX_LINEUP_ORDERS } from "@/lib/game";
import { MIN_WEEKS_TO_RANK } from "@/lib/game/season-rules";
import { DAILY_CAP, QUIET_HOURS } from "@/lib/notify/timing";
import { ROOMS } from "@/lib/rooms";

/*
  The walkthrough somebody gets on their way in.

  Arena had two explanations of itself and a person could sign in without
  meeting either. `/how` is long, good, and signed out on purpose -- it is the
  page you send somebody, not the page you land on. The onboarding screen has
  three lines above a name field, read by a person whose whole attention is on
  the name field. Between them was the actual gap: somebody arrives at Home
  with a hundred thousand pretend dollars, five rooms they have never been
  told about, and no idea what the second number on the scoreboard means.

  So this says the whole thing, once, in the app, to everybody -- and then
  never again. Its rules:

    Every screen is one idea and fits without scrolling on a phone. A modal
    that scrolls is a document, and a document is what /how already is.

    Nothing here is a figure this file made up. The starting balance, the
    lineup size, the season threshold, the notification cap and the rooms are
    all imported from what the game is played by, so the walkthrough cannot
    end up describing a game Arena stopped being.

    Closing it counts as reading it. Escape, the X, and "Skip the tour" all
    write the same version down, because a walkthrough that comes back
    tomorrow because you dismissed it today is a nag with a progress bar.

    The one thing it never does is stand between a person and the room. It
    opens over Home with Home already painted behind it.
*/

type Step = {
  /** The dot label. Short: eight of these share a row on a phone. */
  key: string;
  title: string;
  lede: string;
  rows?: { icon?: React.ComponentType<{ className?: string }>; term: string; text: string }[];
  note?: string;
};

/*
  `ROOMS` is the dock's own list, so the map is guaranteed to be the rooms
  that exist. Only the sentence about each one lives here.
*/
const ROOM_BLURB: Record<string, string> = {
  "/home": "What you own, what it is worth, what moved today, and where your week stands against the market.",
  "/trade": "Buy and sell. Real companies, real prices, whole shares, no borrowing.",
  "/leagues": "Your leagues, the tables, the invite codes, weekly goals, and battles.",
  "/season": "The quarter's ranking, and how many weeks you still need to be placed in it.",
  "/profile": "Every week you have played, your streak, what you have earned, and every switch.",
};

const STEPS: Step[] = [
  {
    key: "Game",
    title: "Arena is a game, and the money is not real",
    lede: `You get ${formatMoney(
      STARTING_BALANCE
    )} of pretend money and buy shares in real companies at real prices. At the end of the week you find out how you did — against the market, and against your friends.`,
    rows: [
      {
        term: "Nothing here is real money",
        text: "You cannot deposit, you cannot withdraw, and you cannot lose money you had. There is no stake and no payout.",
      },
      {
        term: "It is free, and it stays free",
        text: "Nothing you can buy changes a result. Anything paid is more leagues and things to wear next to your name.",
      },
    ],
  },
  {
    key: "Week",
    title: "The week is the whole game",
    lede: "Every Monday at 09:30 New York time everybody starts again with the same money. You buy and sell on weekdays between 09:30 and 16:00. At Friday's close the week is scored, and on Monday everybody is level again.",
    rows: [
      {
        term: "Nothing carries over",
        text: "Somebody who has played for a year starts Monday exactly level with somebody who signed up last night.",
      },
      {
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
        term: "Up is not the same as good",
        text: "Everybody is up in a week the market ran. Up 2% while the market was up 3% is a bad week that looks like a good one.",
      },
      {
        term: "A falling week is still worth playing",
        text: "Losing 1% while the market lost 4% is one of the better things you can do here, and the app says so.",
      },
    ],
  },
  {
    key: "Rooms",
    title: "Where everything is",
    lede: "Five rooms, on the bar along the bottom of the screen. That bar is the whole navigation — there is nothing hidden behind a menu.",
    rows: ROOMS.map((room) => ({
      icon: room.icon,
      term: room.label,
      text: ROOM_BLURB[room.href] ?? "",
    })),
  },
  {
    key: "Leagues",
    title: "A league is where the game actually happens",
    lede: "Playing alone is a spreadsheet. Two people is a game. We have already made you a league of your own — send its code to one person and you have a race.",
    rows: [
      {
        icon: Trophy,
        term: "Private, always",
        text: "Nobody can find your league and nobody joins it without the code. Inside it you see everybody's week and who is immediately ahead of you.",
      },
      {
        icon: Swords,
        term: "Battles",
        text: "A second contest beside the ordinary week, with its own rules: semiconductors only, one company at a time, pick the losers instead of the winners. Anyone in the league can start one.",
      },
      {
        icon: CalendarRange,
        term: "Say what you are going for",
        text: "Once a week you can call your shot — beat the market, finish top three, just show up. It earns nothing. Saying it to people who will see whether you did is the point.",
      },
    ],
    note: "Everybody's holdings are opened to the league once a week is settled, never while it is running.",
  },
  {
    key: "Weekend",
    title: "The weekend is for deciding, not for waiting",
    lede: `The market shuts at 16:00 on Friday and opens at 09:30 on Monday. Nothing moves in between, so there is nothing to miss. What you can do is line up next week: pick up to ${MAX_LINEUP_ORDERS} companies and they are bought for you at Monday's opening price.`,
    rows: [
      {
        term: "No advantage in being early",
        text: "Everybody who leaves a lineup fills at the same opening price. It locks when the market opens, so nothing is ever placed with hindsight.",
      },
      {
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
        text: "Every week you have played is on your profile — what you made, and how it compared to the market. Each was settled on the Friday it happened.",
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
    lede: "Every message is something that actually happened, to you, with a name attached. Every one of them is a switch on your profile, and off means off that moment.",
    rows: [
      {
        icon: BellRing,
        term: "The cap",
        text: `Never more than ${DAILY_CAP} in a day, and never between ${QUIET_HOURS} where you are.`,
      },
      {
        term: "Never about a bad week",
        text: "No “come back”, no “your friends are playing without you”, no invented countdown. Messaging a loss as something one more trade could fix is not going to be built here.",
      },
    ],
    note: "Not a broker. Not real money. Not advice, and not a prediction — a week of picking winners with pretend money tells you very little about picking them with real money.",
  },
];

export function WelcomeTour({ playerName }: { playerName: string | null }) {
  const [open, setOpen] = useState(true);
  const [index, setIndex] = useState(0);
  const [, startSaving] = useTransition();

  const step = STEPS[index]!;
  const last = index === STEPS.length - 1;

  /*
    Written down once, whichever way it ends. `finishTour` is idempotent, but
    Escape firing while the "Done" transition is already in flight would send
    a second write for no reason, so the guard is here rather than there.
  */
  const [closed, setClosed] = useState(false);
  const close = useCallback(() => {
    setOpen(false);
    if (closed) return;
    setClosed(true);
    startSaving(() => {
      void finishTour();
    });
  }, [closed]);

  /*
    Arrow keys, because eight screens is enough that somebody will try. Radix
    already owns Escape and the tab ring; this only adds the two it does not.
  */
  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "ArrowRight") {
        setIndex((i) => Math.min(i + 1, STEPS.length - 1));
      } else if (event.key === "ArrowLeft") {
        setIndex((i) => Math.max(i - 1, 0));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) close();
      }}
    >
      <DialogContent
        className="max-w-[calc(100%-2rem)] sm:max-w-xl"
        /*
          Clicking the page behind a walkthrough is somebody reaching for the
          room, not somebody dismissing eight screens they have not read. The
          X, Escape and the skip link are all still there and all still count.
        */
        onInteractOutside={(event) => event.preventDefault()}
      >
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-3">
            <div className="flex gap-1.5" aria-hidden="true">
              {STEPS.map((s, i) => (
                <span
                  key={s.key}
                  className={cn(
                    "h-1 min-w-0 flex-1 rounded-full transition-colors",
                    i <= index ? "bg-primary" : "bg-muted"
                  )}
                />
              ))}
            </div>
            <p className="text-sm text-muted-foreground tabular-nums">
              Step {index + 1} of {STEPS.length} · {step.key}
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <DialogTitle>
              {index === 0 && playerName ? `Welcome, ${playerName}. ` : ""}
              {step.title}
            </DialogTitle>
            <DialogDescription className="leading-relaxed">
              {step.lede}
            </DialogDescription>
          </div>

          {step.rows?.length ? (
            <ul className="flex flex-col gap-2">
              {step.rows.map((row) => {
                const Icon = row.icon;
                return (
                  <li key={row.term} className={cn(CARD, "flex items-start gap-3")}>
                    {Icon ? (
                      <Icon
                        className="mt-0.5 size-4 shrink-0 text-primary"
                        aria-hidden="true"
                      />
                    ) : null}
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="text-sm font-medium">{row.term}</span>
                      <span className="text-sm text-muted-foreground">{row.text}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : null}

          {step.note ? (
            <p className="text-sm text-muted-foreground">{step.note}</p>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {index > 0 ? (
                <Button variant="ghost" onClick={() => setIndex(index - 1)}>
                  Back
                </Button>
              ) : (
                <Button variant="ghost" onClick={close}>
                  Skip the tour
                </Button>
              )}
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/how"
                className="text-sm text-muted-foreground underline underline-offset-4"
                onClick={close}
              >
                The long version
              </Link>
              <Button
                onClick={() => (last ? close() : setIndex(index + 1))}
              >
                {last ? "Start playing" : "Next"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
