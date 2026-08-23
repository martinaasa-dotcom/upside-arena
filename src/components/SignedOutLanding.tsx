import type { ReactNode } from "react";
import Link from "next/link";
import {
  ArrowLeftRight,
  CalendarClock,
  CalendarRange,
  Check,
  Share2,
  Swords,
  Users,
} from "lucide-react";
import { Arrive } from "@/components/Arrive";
import { ArenaWordmark } from "@/components/brand/ArenaWordmark";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { COMPANY } from "@/lib/company";
import { formatMoney } from "@/lib/format";
import { STARTING_BALANCE } from "@/lib/game";
import { MINIMUM_AGE } from "@/lib/legal";
import { BOX, CARD } from "@/lib/page-shell";
import {
  CLOSING_ASK,
  CLOSING_ASK_TWIST,
  HERO_LEDE,
  HERO_PRICE,
  HERO_PROBLEM,
  HERO_TWIST,
  MORE_ROOMS,
  PRICE_HEADLINE,
  PRICE_NOTE,
  TRUST,
  WAYS_IN,
} from "@/lib/product";
import { cn } from "@/lib/utils";

/*
  The page a stranger lands on.

  This used to be a sign-in box with the game described in two lines beside
  it and a sample league to its right: one screen, finished-looking, and
  everything Arena actually is left for somebody to discover after handing
  over an email address. It is arranged the way a product page is now. The
  hero names the problem and visibly continues past the fold, each section
  afterwards makes one point with the real interface next to it, and the ask
  is repeated at the bottom.

  Ported from Upside Lab's, which was rebuilt the same way, and it keeps
  Lab's flow deliberately: problem, interface, what it does, how you start,
  the rest of the rooms, what it costs and what is at stake, then the ask
  again. The two apps are one design and the landing pages are the first
  thing anybody sees of it. What changes is what Arena is about. Lab asks
  you to paste what you own; Arena asks you to find somebody to beat.

  A server component. Everything here is the same for everybody, so the page
  is prerendered and arrives as HTML from a CDN, with only the sign-in card
  waiting on the request. Arrive is the one client piece, and it is a
  wrapper.

  Design rules it follows, all from the shared system rather than invented
  here: the true-black field with its two ambient lobes is the only
  background, --primary is the only decorative colour, gain and loss stay
  semantic and are used only on figures that really moved, and every surface
  is glass. A card drawn straight on the field is a top-level pane (BOX);
  only a well sitting inside one is glass-well (CARD).
*/

/** One column, one measure, one rhythm. Every section sits in this. */
function Section({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  /*
    48px, 64px from sm, so two adjacent sections put 128px between them on a
    desktop.

    Generous spacing is what makes a product page feel calm, and the mistake
    is reading that as "more is better". What reads as calm is the ratio: the
    gap between sections has to be clearly smaller than the sections it
    separates. These sections are an eyebrow, a line and a row of three
    cards, roughly 250px tall, so a gap much past this reads as the page
    having run out rather than breathing.
  */
  return (
    <section className={cn("px-6 py-12 sm:py-16", className)}>
      <div className="mx-auto w-full min-w-0 max-w-5xl">{children}</div>
    </section>
  );
}

/** Mono caps, in the accent. The only decorative use of colour on the page. */
function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <span className="font-mono text-xs font-medium uppercase tracking-[0.14em] text-primary">
      {children}
    </span>
  );
}

/** Eyebrow, headline, and the line under it. */
function SectionHead({
  eyebrow,
  title,
  detail,
}: {
  eyebrow: string;
  title: string;
  detail?: string;
}) {
  return (
    <div className="flex flex-col gap-4">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className="text-balance text-2xl leading-[1.15] tracking-[-0.03em] sm:text-3xl">
        {title}
      </h2>
      {detail ? (
        <p className="max-w-xl text-base leading-relaxed text-muted-foreground">
          {detail}
        </p>
      ) : null}
    </div>
  );
}

/** The small square an icon sits in, on every card that has one. */
function Glyph({ children }: { children: ReactNode }) {
  return (
    <span
      className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/15"
      aria-hidden="true"
    >
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ hero */

/*
  A league at Friday's close. Fixed numbers, labelled as a sample everywhere
  it appears, because a made-up scoreboard that is not labelled is a claim
  about what somebody will earn.
*/
const SAMPLE_LEAGUE = [
  { rank: 1, name: "Sarah", value: "+4.2%", up: true },
  { rank: 2, name: "You", value: "+3.8%", up: true },
  { rank: 3, name: "Marcus", value: "+1.1%", up: true },
  { rank: 4, name: "Priya", value: "-0.6%", up: false },
];

/**
 * The hero.
 *
 * The problem is named before the product is, because that sentence is the
 * sharpest thing on the page, and the interface arrives directly under it as
 * the answer rather than three screens later.
 *
 * The card below is deliberately allowed to run past the bottom of the
 * window. That cut is the scroll affordance doing the real work: a page
 * whose content is visibly severed by the fold is one nobody mistakes for
 * finished, and it beats any arrow. An arrow would have to sit under the
 * card, which is to say off-screen at exactly the moment the hint is needed.
 */
function Hero({ signIn }: { signIn: ReactNode }) {
  return (
    <section className="px-6 pb-10 pt-[max(2.5rem,env(safe-area-inset-top))] sm:pb-14">
      <div className="mx-auto flex w-full min-w-0 max-w-3xl flex-col items-center text-center">
        <ArenaWordmark className="rise rise-1" size={40} />

        {/*
          Two type steps, not two headlines.

          The copy is fixed and the type moves. A shorter sentence on a phone
          would mean keeping two versions of the hook in step, which is a
          promise nobody keeps, so 26px with tighter leading lands it in four
          lines on a 390px screen while staying comfortably the largest thing
          on the page. The desktop step is untouched.
        */}
        <h1 className="rise rise-2 mt-9 text-balance text-[1.625rem] leading-[1.12] tracking-[-0.04em] sm:mt-10 sm:text-[2.75rem] sm:leading-[1.14] sm:tracking-[-0.035em]">
          {HERO_PROBLEM}
          <span className="mt-1.5 block text-muted-foreground">{HERO_TWIST}</span>
        </h1>

        <p className="rise rise-2 mt-6 max-w-lg text-lg leading-relaxed text-muted-foreground">
          {HERO_LEDE}
        </p>

        {/*
          The one thing on the page that is not the same for everybody, and
          the anchor the closing ask jumps back to.
        */}
        <div id="start" className="rise rise-3 mt-8 w-full max-w-sm scroll-mt-8">
          {signIn}
        </div>

        <p className="rise rise-3 mt-4 text-sm text-muted-foreground">
          {HERO_PRICE}
        </p>

        {/*
          Age is asserted here, in the same sentence as the terms, rather than
          behind its own tick box: a checkbox is a thing to get past rather
          than a thing anyone reads, and it puts a dead button in front of
          every new person. Continuing is the affirmative act, and it is
          recorded against the account.

          It stays directly under the card and is not repeated at the bottom,
          because this is the only place on the page where continuing actually
          happens. The closing ask is a link back up to here.
        */}
        <p className="rise rise-4 mt-6 max-w-sm text-sm leading-relaxed text-muted-foreground">
          By continuing you confirm you are {MINIMUM_AGE} or older and agree to
          the{" "}
          <Link
            href="/legal/terms"
            className="underline underline-offset-4 hover:text-foreground"
          >
            Terms
          </Link>{" "}
          and{" "}
          <Link
            href="/legal/privacy"
            className="underline underline-offset-4 hover:text-foreground"
          >
            Privacy policy
          </Link>
          . Not financial advice. Help:{" "}
          <a
            href={`mailto:${COMPANY.supportEmail}`}
            className="underline underline-offset-4 hover:text-foreground"
          >
            {COMPANY.supportEmail}
          </a>
          .
        </p>
      </div>

      <div className="rise rise-4 mx-auto mt-12 w-full min-w-0 max-w-3xl sm:mt-14">
        <FridayClose />
      </div>
    </section>
  );
}

/** The week, settled, at full column width. The thing the game produces. */
function FridayClose() {
  return (
    <div className="relative">
      <div
        className="pointer-events-none absolute -inset-4 -z-10 rounded-[3rem] bg-gradient-to-br from-primary/12 to-transparent opacity-70 blur-3xl"
        aria-hidden="true"
      />

      <div
        className="card-sheen glass rounded-xl p-5 shadow-2xl shadow-black/60 ring-1 ring-primary/15"
        aria-hidden="true"
      >
        <div className="flex items-center justify-between gap-3">
          <Eyebrow>Friday close</Eyebrow>
          <Badge variant="outline">Sample</Badge>
        </div>

        <div className="mt-5 grid gap-5 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
          <div className="text-left">
            <p className="text-sm text-muted-foreground">Sunday Roasters</p>
            <p className="figure mt-1 text-3xl font-bold">$103,800</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="figure rounded-md bg-gain/15 px-2 py-1 text-sm font-semibold text-gain">
                You +3.8%
              </span>
              <span className="figure rounded-md bg-muted px-2 py-1 text-sm font-semibold">
                Market +1.2%
              </span>
            </div>
          </div>

          <div className="glass-well divide-y divide-border overflow-hidden rounded-lg">
            {SAMPLE_LEAGUE.map((row) => (
              <div key={row.rank} className="flex h-10 items-center gap-3 px-3">
                <span className="figure w-4 shrink-0 text-xs text-muted-foreground">
                  {row.rank}
                </span>
                <span className="min-w-0 flex-1 truncate text-left text-sm">
                  {row.name}
                </span>
                <span
                  className={cn(
                    "figure shrink-0 text-sm font-medium",
                    row.up ? "text-gain" : "text-loss"
                  )}
                >
                  {row.value}
                </span>
              </div>
            ))}
          </div>
        </div>

        <p className="mt-5 text-left text-sm leading-relaxed text-muted-foreground">
          You are 0.4% behind Sarah with a day to go, and the whole league is
          ahead of the market this week. One good Friday closes that gap, and
          everybody gets to see whether it did.
        </p>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- sections */

/** What the two rooms somebody lives in actually look like. */
function WhatItDoes() {
  return (
    <Section>
      <Arrive>
        <SectionHead
          eyebrow="What it does"
          title="The same money on Monday. A scoreboard on Friday. An argument all week."
        />
      </Arrive>
      <Arrive delayMs={80}>
        <div className="mt-10 grid gap-4 md:grid-cols-2">
          <WeekStill />
          <BattleStill />
        </div>
      </Arrive>
    </Section>
  );
}

/*
  Your week, and the figure that makes it honest.

  Both numbers, because one of them on its own is the lie every stock game
  tells. Everybody is up in a week the market ran, and being up 2% in a week
  the market made 3% is a bad week wearing a green number.
*/
function WeekStill() {
  return (
    <div className={cn(BOX, "flex flex-col gap-4")} aria-hidden="true">
      <div className="flex items-center justify-between gap-3">
        <Eyebrow>Your week</Eyebrow>
        <Badge variant="outline">Sample</Badge>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className={cn(CARD, "flex flex-col gap-1")}>
          <span className="text-xs text-muted-foreground">You</span>
          <span className="figure text-xl font-semibold text-gain">+3.8%</span>
        </div>
        <div className={cn(CARD, "flex flex-col gap-1")}>
          <span className="text-xs text-muted-foreground">The market</span>
          <span className="figure text-xl font-semibold">+1.2%</span>
        </div>
      </div>

      <div className={cn(CARD, "flex flex-col gap-2")}>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="gain">2.6 ahead of the market</Badge>
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">
          The second figure is the honest one. Losing 1% in a week the market
          lost 4% is one of the better things you can do here, and Arena says
          so rather than showing you a red number and leaving it there.
        </p>
      </div>

      {/*
        The third thing Home shows, and the reason there is anything to open
        on a Tuesday: two slowly moving numbers give nobody a reason to come
        back. A big move is what happened, not a reason to buy anything, and
        the room says so in those words.
      */}
      <div className={cn(CARD, "flex flex-col gap-2")}>
        <span className="text-xs text-muted-foreground">What moved today</span>
        {SAMPLE_MOVERS.map((mover) => (
          <div key={mover.symbol} className="flex items-center gap-3">
            <span className="figure min-w-0 flex-1 truncate text-sm">
              {mover.symbol}
            </span>
            <span className="truncate text-xs text-muted-foreground">
              {mover.why}
            </span>
            <span
              className={cn(
                "figure shrink-0 text-sm font-medium",
                mover.up ? "text-gain" : "text-loss"
              )}
            >
              {mover.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/*
  Two real moves, of the kind Home lists: something a person would recognise,
  and something they are holding. Labelled a sample with the rest of the card.
*/
const SAMPLE_MOVERS = [
  { symbol: "NVDA", why: "Held", value: "+4.1%", up: true },
  { symbol: "DIS", why: "Big mover", value: "-3.2%", up: false },
];

/*
  A battle, which is the part people come back for once the ordinary week has
  gone stale. The rule on the card is the rule the trade is checked against.
*/
const SAMPLE_BATTLE = [
  { rank: 1, name: "Marcus", value: "+9.1%", up: true },
  { rank: 2, name: "You", value: "+7.4%", up: true },
  { rank: 3, name: "Sarah", value: "+2.2%", up: true },
  { rank: 4, name: "Priya", value: "-1.5%", up: false },
];

function BattleStill() {
  return (
    <div className={cn(BOX, "flex flex-col gap-4")} aria-hidden="true">
      <div className="flex items-center justify-between gap-3">
        <Eyebrow>A battle</Eyebrow>
        <Badge variant="outline">Sample</Badge>
      </div>

      <div className={cn(CARD, "flex flex-col gap-2")}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">Silicon</span>
          <Badge variant="outline">3 days left</Badge>
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Only the twenty-four semiconductor companies on the list. Everybody
          in the league is in it, everybody starts level, and nothing about it
          touches your record or the season.
        </p>
      </div>

      <div className="glass-well divide-y divide-border overflow-hidden rounded-lg">
        {SAMPLE_BATTLE.map((row) => (
          <div key={row.rank} className="flex h-10 items-center gap-3 px-3">
            <span className="figure w-4 shrink-0 text-xs text-muted-foreground">
              {row.rank}
            </span>
            <span className="min-w-0 flex-1 truncate text-sm">{row.name}</span>
            <span
              className={cn(
                "figure shrink-0 text-sm font-medium",
                row.up ? "text-gain" : "text-loss"
              )}
            >
              {row.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

const WAY_IN_ICONS = {
  users: Users,
  share: Share2,
  trade: ArrowLeftRight,
} as const;

function HowYouStart() {
  return (
    <Section>
      <Arrive>
        <SectionHead
          eyebrow="Getting started"
          title="It starts with the people you already argue with."
          detail={`No broker, no deposit, no card, and nothing to connect. You sign in, you get ${formatMoney(
            STARTING_BALANCE
          )} of pretend money and a league with a code in it, and you are playing inside a minute.`}
        />
      </Arrive>
      <Arrive delayMs={80}>
        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {WAYS_IN.map((way) => {
            const Icon = WAY_IN_ICONS[way.icon];
            return (
              <div
                key={way.title}
                className={cn(BOX, "flex flex-col items-start gap-3")}
              >
                <Glyph>
                  <Icon className="size-4" />
                </Glyph>
                <h3 className="text-base">{way.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {way.detail}
                </p>
              </div>
            );
          })}
        </div>
      </Arrive>
    </Section>
  );
}

const MORE_ICONS = {
  battles: Swords,
  season: CalendarRange,
  weekend: CalendarClock,
} as const;

function MoreRooms() {
  return (
    <Section>
      <Arrive>
        <SectionHead
          eyebrow="And the rest"
          title="Three more things, once you are in."
        />
      </Arrive>
      <Arrive delayMs={80}>
        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {MORE_ROOMS.map((room) => {
            const Icon = MORE_ICONS[room.icon];
            return (
              <div
                key={room.title}
                className={cn(BOX, "flex flex-col items-start gap-3")}
              >
                <Glyph>
                  <Icon className="size-4" />
                </Glyph>
                <h3 className="text-base">{room.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {room.detail}
                </p>
              </div>
            );
          })}
        </div>
      </Arrive>
    </Section>
  );
}

/*
  Price and stakes together, because they are one question asked twice: what
  is this going to cost me, in money and in risk. Both were answered nowhere
  on the old page, which reads as something to find out later.
*/
function PriceAndStakes() {
  return (
    <Section>
      <Arrive>
        {/*
          `items-start`, so each card is its own height.

          These two are not peers the way the stills above are: one is a
          statement and a note, the other is a list of four. Stretched to
          match, the shorter one grows exactly the panel-coloured void
          page-shell.ts warns about under SPLIT.
        */}
        <div className="grid items-start gap-4 md:grid-cols-2">
          <div className={cn(BOX, "flex flex-col gap-4")}>
            <Eyebrow>What it costs</Eyebrow>
            <p className="text-balance text-xl font-semibold leading-snug tracking-[-0.02em]">
              {PRICE_HEADLINE}
            </p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {PRICE_NOTE}
            </p>
          </div>

          <div className={cn(BOX, "flex flex-col gap-4")}>
            <Eyebrow>Nothing real is at stake</Eyebrow>
            <ul className="flex flex-col gap-3">
              {TRUST.map((line) => (
                <li
                  key={line}
                  className="flex items-start gap-2.5 text-sm leading-relaxed text-muted-foreground"
                >
                  <Check
                    className="mt-0.5 size-4 shrink-0 text-primary"
                    aria-hidden="true"
                  />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Arrive>
    </Section>
  );
}

/** The ask again, so nobody has to scroll back up hunting for it. */
function Closing() {
  return (
    /*
      Barely any top padding, and the section above keeps its own.

      Two full section pads met here and added up to about 160px of empty
      black between the last card and this headline, which stranded the
      closing ask on its own rather than letting it land as the end of
      something. A coda sits close to what it concludes. The bottom pad stays
      generous, because that space is the page ending rather than a gap
      between two things.
    */
    <Section className="pt-2 pb-[max(6rem,env(safe-area-inset-bottom))] sm:pt-4">
      <Arrive>
        <div className="flex flex-col items-center gap-6 text-center">
          <h2 className="max-w-xl text-balance text-2xl leading-[1.15] tracking-[-0.03em] sm:text-3xl">
            {CLOSING_ASK}
            <span className="block text-muted-foreground">
              {CLOSING_ASK_TWIST}
            </span>
          </h2>

          {/*
            A link back to the card rather than a second copy of it.

            Lab repeats its button here, and it can: signing in there is one
            button with nothing in it. Arena's is a card with an email field,
            and a second one on the same page is a second form, a second
            label reading "Email", and a second signin_viewed counted for one
            visitor. So the ask is a link, it lands on the real card, and the
            legal line stays where continuing actually happens.
          */}
          <Button asChild size="cta">
            <Link href="#start">Start a league</Link>
          </Button>

          <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
            <Link
              href="/how"
              className="text-foreground underline underline-offset-4"
            >
              How Arena works
            </Link>{" "}
            explains the whole game in two minutes, and needs no account.
          </p>
        </div>
      </Arrive>
    </Section>
  );
}

/* ------------------------------------------------------------------ page */

export function SignedOutLanding({ signIn }: { signIn: ReactNode }) {
  return (
    <main id="main" className="relative z-10 flex flex-1 flex-col">
      <Hero signIn={signIn} />
      <WhatItDoes />
      <HowYouStart />
      <MoreRooms />
      <PriceAndStakes />
      <Closing />
    </main>
  );
}
