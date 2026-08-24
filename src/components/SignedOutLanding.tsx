import type { ReactNode } from "react";
import Link from "next/link";
import { CalendarClock, CalendarRange, Check, Swords } from "lucide-react";
import { Arrive } from "@/components/Arrive";
import { ArenaWordmark } from "@/components/brand/ArenaWordmark";
import { ScrollCue } from "@/components/ScrollCue";
import { Badge } from "@/components/ui/badge";
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
  PRICE_TITLE,
  TRUST,
  TRUST_TITLE,
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
  afterwards makes one point, and the ask is repeated at the bottom.

  It keeps Upside Lab's flow deliberately, because the two apps are one
  design and the landing pages are the first thing anybody sees of it. What
  changes is what Arena is about. Lab asks you to paste what you own; Arena
  asks you to find somebody to beat.

  Three rules this page is held to that the rest of the app is not, all of
  them about restraint rather than decoration:

  ONE HEADLINE, ONE LINE UNDER IT, AND THEN THE THING. No eyebrow above
  every section in small coloured capitals. That pattern is everywhere in
  software marketing and nowhere in the app itself, so a page wearing it
  reads as a landing page about Arena rather than as Arena. The section
  headline is large enough to be the label.

  A CARD GETS ONE LINE. The first draft ran three sentences under every
  heading and two more inside every card, and the effect of that much
  explaining is not thoroughness, it is doubt. Anything needing a paragraph
  belongs on /how, which is linked and needs no account.

  SIZE IS THE ARGUMENT. The headline is 64px on a desktop, the section
  headings 44px, and body copy 16px rather than 14px, because the one thing
  a first screen has to do is sound certain. The copy in product.ts is short
  enough to afford it.

  A server component. Everything here is the same for everybody, so the page
  is prerendered and arrives as HTML from a CDN, with only the sign-in card
  waiting on the request. Arrive is the one client piece, and it is a
  wrapper.

  Colour, glass and figures are the shared system, not invented here: the
  true-black field with its two ambient lobes is the only background,
  --primary is the only decorative colour, gain and loss stay semantic and
  appear only on figures that really moved. A pane drawn straight on the
  field is top-level (BOX); only a well inside one is glass-well (CARD).
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
    ONE WIDTH, AND EVERY PANE ON THE PAGE SHARES ITS EDGES.

    The stills used to sit in a wider container than the rest, on the theory
    that a picture of the app should be as wide as the app. Measured at
    1440px that put three different left edges down one page: 336, 120 and
    208. Nothing about that reads as "the interface is emphasised", it reads
    as a page assembled from parts, because the eye tracks a vertical edge
    far more readily than it registers a container's intent. Everything is
    1024 now, hero card included, and the only narrower measure is the run
    of centred text in the hero, which is a measure rather than an edge.

    Generous spacing is what makes a product page feel calm, and the mistake
    is reading that as "more is better". What reads as calm is the ratio, and
    the ratio a scrolling reader actually experiences is against the window
    rather than against the section: nobody sees a 480px section and a 160px
    gap side by side and compares them, they see a screen. 160px is 18% of a
    900px window, measured as the tallest empty band on this page, and it is
    what a reader lands in when one flick of a wheel happens to stop on a
    boundary. Two of those in a row read as the page having run out.

    96px on a desktop, 80px on a phone. Still clearly smaller than the
    sections it separates, which is the test the note above sets, and now
    also small enough that no boundary can fill a fifth of the screen with
    nothing. The other half of that fault is in `Arrive`.
  */
  return (
    <section className={cn("px-6 py-10 sm:py-12", className)}>
      <div className="mx-auto w-full min-w-0 max-w-5xl">{children}</div>
    </section>
  );
}

/**
 * A section headline, and at most one line under it.
 *
 * The size lives on the `<h2>` itself. The element rules in globals.css set
 * weight and tracking for every heading and a size for `h1` alone, so a
 * heading asking for a step the scale does not have says so here.
 */
function SectionHead({
  title,
  detail,
  className,
}: {
  title: string;
  detail?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        /*
          Centred, because the page is a centred composition: the hero is,
          the closing ask is, and left-aligned headings between them made the
          middle read as a different document spliced in.
        */
        "mx-auto flex max-w-3xl flex-col items-center gap-5 text-center",
        className
      )}
    >
      <h2 className="text-balance text-[1.75rem] leading-[1.1] tracking-[-0.03em] sm:text-[2.75rem] sm:leading-[1.08] sm:tracking-[-0.035em]">
        {title}
      </h2>
      {detail ? (
        <p className="max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
          {detail}
        </p>
      ) : null}
    </div>
  );
}

/**
 * The label at the top of a still, and the Sample badge beside it.
 *
 * Deliberately the app's own small muted label rather than anything
 * invented for this page. These panes are here to be believed, and a still
 * wearing chrome the product does not have is a mock-up.
 *
 * Every still says Sample. A made-up scoreboard that is not labelled is a
 * claim about what somebody is going to earn.
 */
function StillHead({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <Badge variant="outline">Sample</Badge>
    </div>
  );
}

/**
 * Age and the terms, in one sentence, next to a button that signs somebody in.
 *
 * There is no tick box: a checkbox is a thing to get past rather than a thing
 * anyone reads, and it puts a disabled button in front of every new person.
 * Continuing is the affirmative act, and the durable record is the
 * `terms_acceptances` row written at onboarding.
 *
 * It appears beside BOTH buttons rather than once at the top, because it is
 * consent and consent belongs where the action is. Somebody who reads to the
 * end and signs up from the closing ask has to have been told the same thing
 * as somebody who signed up from the hero.
 *
 * What is deliberately no longer in it is the advice disclaimer and the
 * support address, which went to the footer. Four lines of grey small print
 * directly under the one control on the screen is the loudest possible way to
 * say "there is small print here".
 */
function Consent({ className }: { className?: string }) {
  return (
    <p
      className={cn(
        "max-w-sm text-sm leading-relaxed text-muted-foreground",
        className
      )}
    >
      By continuing you confirm you are {MINIMUM_AGE} or older and agree to the{" "}
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
      .
    </p>
  );
}

/** A row in a scoreboard, drawn the way the real standings table draws it. */
function StandingRow({
  rank,
  name,
  value,
  up,
}: {
  rank: number;
  name: string;
  value: string;
  up: boolean;
}) {
  return (
    <div className="flex h-10 items-center gap-3 px-3">
      <span className="figure w-4 shrink-0 text-xs text-muted-foreground">
        {rank}
      </span>
      <span className="min-w-0 flex-1 truncate text-left text-sm">{name}</span>
      <span
        className={cn(
          "figure shrink-0 text-sm font-medium",
          up ? "text-gain" : "text-loss"
        )}
      >
        {value}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ hero */

/** A league at Friday's close. Fixed numbers, labelled as a sample. */
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
 * sharpest thing on the page, and the week arrives directly under it as the
 * answer rather than three screens later.
 *
 * The card is deliberately allowed to run past the bottom of the window,
 * because a page whose content is visibly severed by the fold is one nobody
 * mistakes for finished, and on every phone and most laptops that is what
 * happens. On a taller window there is no cut, so the height floor below
 * keeps the next section's heading in view instead. Between those two, on a
 * window where the card clears the fold whole and nothing after it has
 * started, `ScrollCue` says it in words. Which of the three a reader gets is
 * measured on the real page rather than guessed at, and the cue is laid out
 * inside this section so that it scrolls with the page rather than hovering
 * over it.
 */
function Hero({ signIn }: { signIn: ReactNode }) {
  return (
    /*
      At least one screen tall, less 9rem.

      `min-h` only bites when the hero is shorter than the window. Given the
      floor, the hero fills the window bar 9rem, so the top of the next
      section is always in view and what a reader sees at rest is a section
      beginning rather than a page ending. On a shorter window the hero is
      taller than this and the card is cut instead, which says the same thing
      more loudly.

      9rem and not less, because what has to be in view is a heading rather
      than a section's own top padding: 48px of that peek is the pad, which
      leaves 96px of the heading showing. That is also what makes `ScrollCue`
      stand down on a tall window, since the page is already saying it. `svh`
      rather than `dvh`, so a phone that later retracts its address bar does
      not find the hero taller than the window it was sized against.

      `relative`, because the cue is laid out against the top of this
      section, which is the top of the document.
    */
    <section className="relative min-h-[calc(100svh-9rem)] px-6 pb-12 pt-[max(2.5rem,env(safe-area-inset-top))] sm:pb-16">
      <div className="mx-auto flex w-full min-w-0 max-w-3xl flex-col items-center text-center">
        <ArenaWordmark className="rise rise-1" size={38} />

        {/*
          Two type steps, not two headlines, and both lines short enough to
          hold one line each at 64px in this column. The copy is what buys
          the size; see the note in product.ts.
        */}
        <h1 className="rise rise-2 mt-10 text-balance text-[2.25rem] leading-[1.05] tracking-[-0.04em] sm:mt-12 sm:text-[4rem] sm:leading-[1.02] sm:tracking-[-0.04em]">
          {HERO_PROBLEM}
          <span className="mt-1 block text-muted-foreground">{HERO_TWIST}</span>
        </h1>

        <p className="rise rise-3 mt-7 max-w-2xl text-lg leading-relaxed text-muted-foreground sm:mt-8 sm:text-xl">
          {HERO_LEDE}
        </p>

        {/* The one thing on the page that is not the same for everybody. */}
        <div className="rise rise-3 mt-10 flex w-full justify-center">
          {signIn}
        </div>

        <p className="rise rise-3 mt-4 text-sm text-muted-foreground">
          {HERO_PRICE}
        </p>

        <Consent className="rise rise-4 mt-5" />
      </div>

      {/*
        Marked, because `ScrollCue` measures this card against the fold. A
        card the fold cuts needs no words under it, and a card that clears
        the fold whole leaves nothing else on the screen saying the page
        continues.
      */}
      <div
        data-scroll-cue-still
        className="rise rise-4 mx-auto mt-14 w-full min-w-0 max-w-5xl sm:mt-16"
      >
        <FridayClose />
      </div>

      {/*
        In the page rather than over it: it draws in the band just above the
        first fold and scrolls away with the hero. See ScrollCue.tsx for what
        pinning it to the window cost.
      */}
      <ScrollCue />
    </section>
  );
}

/** The week, settled. The thing the game produces, at the top of the page. */
function FridayClose() {
  return (
    <div className="relative">
      {/* One quiet lift behind the card, not a halo. See `.ambient-glow`. */}
      <div className="ambient-glow" aria-hidden="true" />

      <div
        className="card-sheen glass rounded-xl p-5 shadow-2xl shadow-black/60 ring-1 ring-primary/15 sm:p-6"
        aria-hidden="true"
      >
        <StillHead label="Friday close" />

        <div className="mt-5 grid gap-5 sm:grid-cols-[minmax(0,16rem)_minmax(0,1fr)] sm:gap-6">
          <div className="text-left">
            <p className="text-sm text-muted-foreground">Sunday Roasters</p>
            <p className="figure mt-1 text-3xl font-bold sm:text-4xl">
              $103,800
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
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
              <StandingRow key={row.rank} {...row} />
            ))}
          </div>
        </div>

        <p className="mt-5 text-left text-sm leading-relaxed text-muted-foreground">
          You are 0.4% behind Sarah with a day to go, and the whole league is
          ahead of the market this week.
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
        <SectionHead title="The same money on Monday. A scoreboard on Friday. An argument all week." />
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <WeekStill />
          <BattleStill />
        </div>
      </Arrive>
    </Section>
  );
}

/*
  Two real moves, of the kind Home lists: one a person would recognise, and
  one they are holding.
*/
const SAMPLE_MOVERS = [
  { symbol: "NVDA", why: "Held", value: "+4.1%", up: true },
  { symbol: "DIS", why: "Big mover", value: "-3.2%", up: false },
];

/*
  Your week, and the figure that makes it honest.

  Both numbers, because one of them on its own is the lie every stock game
  tells. Everybody is up in a week the market ran, and being up 2% in a week
  the market made 3% is a bad week wearing a green number.
*/
function WeekStill() {
  return (
    <div className={cn(BOX, "flex flex-col gap-4")} aria-hidden="true">
      <StillHead label="Your week" />

      <div className="grid grid-cols-2 gap-3">
        <div className={cn(CARD, "flex flex-col gap-1")}>
          <span className="text-xs text-muted-foreground">You</span>
          <span className="figure text-2xl font-semibold text-gain">+3.8%</span>
        </div>
        <div className={cn(CARD, "flex flex-col gap-1")}>
          <span className="text-xs text-muted-foreground">The market</span>
          <span className="figure text-2xl font-semibold">+1.2%</span>
        </div>
      </div>

      <div className={cn(CARD, "flex flex-col gap-2")}>
        <Badge variant="gain">2.6 ahead of the market</Badge>
        <p className="text-sm leading-relaxed text-muted-foreground">
          The second figure is the honest one. Losing 1% in a week the market
          lost 4% is one of the better things you can do here.
        </p>
      </div>

      {/*
        The third thing Home shows, and the reason there is anything to open
        on a Tuesday. A big move is what happened, not a reason to buy
        anything, and the room says so in those words.
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
  A battle, which is the part people come back for once the ordinary week
  has gone stale. The rule on the card is the rule the trade is checked
  against.
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
      <StillHead label="A battle" />

      <div className={cn(CARD, "flex flex-col gap-2")}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">Silicon</span>
          <Badge variant="outline">3 days left</Badge>
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Only the twenty-four semiconductor companies on the list. Everybody
          in the league is in it, and nothing about it touches the season.
        </p>
      </div>

      <div className="glass-well divide-y divide-border overflow-hidden rounded-lg">
        {SAMPLE_BATTLE.map((row) => (
          <StandingRow key={row.rank} {...row} />
        ))}
      </div>
    </div>
  );
}

/**
 * Getting started, counted rather than iconned.
 *
 * It is a sequence, so it is numbered, and the numerals are the only
 * ornament. The row this replaced was three boxes each carrying a tinted
 * rounded square with a glyph in it, which is the house style of software
 * marketing and appears nowhere in Arena itself.
 */
function HowYouStart() {
  return (
    <Section>
      <Arrive>
        <SectionHead
          title="It starts with the people you already argue with."
          detail={`No broker, no deposit, no card, and nothing to connect. Sign in and you have ${formatMoney(
            STARTING_BALANCE
          )} of pretend money and a league with a code in it.`}
        />
        <ol className="mt-8 grid gap-10 sm:grid-cols-3 sm:gap-8">
          {WAYS_IN.map((way, index) => (
            <li key={way.title} className="flex flex-col items-center gap-3 text-center">
              <span
                className="figure text-sm text-primary"
                /*
                  The list already numbers itself for a screen reader, so the
                  numeral drawn here is decoration and says so. Without this
                  every step is read out with its number twice.
                */
                aria-hidden="true"
              >
                {String(index + 1).padStart(2, "0")}
              </span>
              <h3 className="text-lg">{way.title}</h3>
              <p className="text-base leading-relaxed text-muted-foreground">
                {way.detail}
              </p>
            </li>
          ))}
        </ol>
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
        <SectionHead title="The week is only the start of it." />
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {MORE_ROOMS.map((room) => {
            const Icon = MORE_ICONS[room.icon];
            return (
              <div
                key={room.title}
                className={cn(BOX, "flex flex-col items-start gap-3")}
              >
                {/*
                  A plain glyph in the accent, not a glyph inside a tinted
                  rounded square. The square is the tell; the icon is fine.
                */}
                <Icon className="size-5 text-primary" aria-hidden="true" />
                <h3 className="text-lg">{room.title}</h3>
                <p className="text-base leading-relaxed text-muted-foreground">
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
  on the page this replaced, which reads as something to find out later.
*/
function PriceAndStakes() {
  return (
    <Section>
      <Arrive>
        {/*
          `items-start`, so each pane is its own height. One is a statement
          and a note, the other is a list of four, and stretched to match the
          shorter one grows exactly the panel-coloured void page-shell.ts
          warns about under SPLIT.
        */}
        <div className="grid items-start gap-4 md:grid-cols-2">
          <div className={cn(BOX, "flex flex-col gap-4")}>
            <h3 className="text-lg">{PRICE_TITLE}</h3>
            <p className="text-balance text-2xl leading-snug tracking-[-0.02em]">
              {PRICE_HEADLINE}
            </p>
            <p className="text-base leading-relaxed text-muted-foreground">
              {PRICE_NOTE}
            </p>
          </div>

          <div className={cn(BOX, "flex flex-col gap-4")}>
            <h3 className="text-lg">{TRUST_TITLE}</h3>
            <ul className="flex flex-col gap-3">
              {TRUST.map((line) => (
                <li
                  key={line}
                  className="flex items-start gap-3 text-base leading-relaxed text-muted-foreground"
                >
                  <Check
                    className="mt-1 size-4 shrink-0 text-primary"
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
function Closing({ signInAgain }: { signInAgain: ReactNode }) {
  return (
    /*
      Barely any top padding, and the section above keeps its own.

      Two full section pads met here and added up to a screen of empty black
      between the last pane and this headline, which stranded the closing ask
      on its own rather than letting it land as the end of something. A coda
      sits close to what it concludes.
    */
    <Section className="pt-4 pb-20 sm:pt-6 sm:pb-28">
      <Arrive>
        <div className="flex flex-col items-center gap-8 text-center">
          <h2 className="max-w-2xl text-balance text-[1.75rem] leading-[1.1] tracking-[-0.03em] sm:text-[2.75rem] sm:leading-[1.08] sm:tracking-[-0.035em]">
            {CLOSING_ASK}
            <span className="block text-muted-foreground">
              {CLOSING_ASK_TWIST}
            </span>
          </h2>

          {/*
            The real button, not a link back up to one.

            While Arena still offered a magic link this had to be an anchor:
            the sign-in was a card with an email field in it, and a second copy
            would have been a second form, a second control labelled "Email"
            and one visitor counted twice. Google-only makes signing in a
            single button, so the ask at the bottom can be the ask rather than
            a way back to it, which is what Upside Lab's does and what anybody
            who has read to the end of a page expects to find there.
          */}
          <div className="flex justify-center">{signInAgain}</div>

          <Consent />
        </div>
      </Arrive>
    </Section>
  );
}

/**
 * The footer, which this page did not have.
 *
 * A landing page that simply stops is a page with nothing behind it. This
 * is also where the advice disclaimer and the support address moved to,
 * out of the hero: they are true and they have to be somewhere, and the
 * bottom of the page is where a reader goes looking for them.
 *
 * Deliberately quiet. Four links, two sentences, and the mark.
 */
function Footer() {
  return (
    <footer className="border-t border-border px-6 py-12 pb-[max(3rem,env(safe-area-inset-bottom))]">
      <div className="mx-auto flex w-full min-w-0 max-w-5xl flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
        <ArenaWordmark size={18} />

        <div className="flex flex-col gap-4 text-sm text-muted-foreground sm:items-end sm:text-right">
          <nav
            aria-label="Footer"
            className="flex flex-wrap gap-x-6 gap-y-2"
          >
            <Link href="/how" className="hover:text-foreground">
              How Arena works
            </Link>
            <Link href="/legal/terms" className="hover:text-foreground">
              Terms of use
            </Link>
            <Link href="/legal/privacy" className="hover:text-foreground">
              Privacy
            </Link>
            <a
              href={`mailto:${COMPANY.supportEmail}`}
              className="hover:text-foreground"
            >
              Support
            </a>
          </nav>

          <p className="max-w-md leading-relaxed">
            Play money only, and nothing in it is redeemable. Not financial
            advice, and not a recommendation to buy anything.
          </p>

          <p>
            {COMPANY.legalName}, {COMPANY.country}.
          </p>
        </div>
      </div>
    </footer>
  );
}

/* ------------------------------------------------------------------ page */

export function SignedOutLanding({
  signIn,
  signInAgain,
}: {
  signIn: ReactNode;
  signInAgain: ReactNode;
}) {
  return (
    <div className="relative z-10 flex flex-1 flex-col">
      <main id="main">
        <Hero signIn={signIn} />
        <WhatItDoes />
        <HowYouStart />
        <MoreRooms />
        <PriceAndStakes />
        <Closing signInAgain={signInAgain} />
      </main>
      <Footer />
    </div>
  );
}
