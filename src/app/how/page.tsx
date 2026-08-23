import Link from "next/link";
import { ArenaWordmark } from "@/components/brand/ArenaWordmark";
import { TrackView } from "@/components/TrackView";
import { PAGE, PAGE_FRAME } from "@/lib/page-shell";
import { MAX_LINEUP_ORDERS, STARTING_BALANCE } from "@/lib/game";
import { FORMATS } from "@/lib/game/formats";
import { LENGTHS } from "@/lib/game/lengths";
import { MIN_WEEKS_TO_RANK } from "@/lib/game/seasons";
import { DAILY_CAP, QUIET_HOURS } from "@/lib/notify/timing";
import { KINDS } from "@/lib/notify/kinds";
import { formatMoney } from "@/lib/format";

export const metadata = {
  title: "How Arena works",
  description:
    "A free weekly stock-picking game you play with friends. Play money only, nothing redeemable, nothing real at stake.",
};

/*
  The page that says what this actually is.

  Everything else in the app explains itself one panel at a time, in the place
  it is needed, which is right. What was missing was somewhere that says the
  whole thing in order: what the money is, what a week is, why the market is
  the thing you are measured against, what a league is for, what the weekend
  is for, and what none of this is.

  Signed out on purpose. It is the page you send somebody before they have an
  account, and asking for one first would be asking them to trust a scoreboard
  they have not been allowed to read the rules of.

  The formats and the lengths are rendered from the same data the game is
  played by, rather than written out here. A rules page that can disagree with
  the rules is worse than no rules page.
*/
export default function HowPage() {
  return (
    <div className={PAGE_FRAME}>
      <TrackView event="how_it_works_viewed" />

      <main id="main" className={`${PAGE} py-12`}>
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-10">
          <div>
            <Link href="/" className="inline-block">
              <ArenaWordmark className="mb-10" />
              <span className="sr-only">Upside Arena home</span>
            </Link>

            <h1>How Arena works</h1>
            <p className="mt-3 text-base text-muted-foreground">
              Two minutes, and then you know the whole game. There is not much
              to it on purpose.
            </p>
          </div>

          <Section title="1. It is a game, and the money is not real">
            <p>
              You are given {formatMoney(STARTING_BALANCE)} of pretend money.
              You buy shares in real companies at real prices, and at the end of
              the week you find out how you did against everybody else.
            </p>
            <p>
              Nothing here is redeemable, transferable or worth anything. You
              cannot deposit, you cannot withdraw, and you cannot lose money you
              had. Arena is not a broker and nothing in it is advice about what
              to do with money you actually have.
            </p>
          </Section>

          <Section title="2. The week is the game">
            <p>
              Every Monday at 09:30 New York time, everybody starts again with
              the same {formatMoney(STARTING_BALANCE)}. You buy and sell during
              market hours, weekdays from 09:30 to 16:00. At Friday&rsquo;s
              close the week is scored and that is that.
            </p>
            <p>
              Nothing carries over. Somebody who has played for a year starts
              Monday exactly level with somebody who signed up on Sunday night,
              which is the whole reason a league stays worth playing after the
              first month.
            </p>
            <p>
              Whole shares only, no borrowing, no leverage. Cash earns nothing,
              so sitting on it is a decision rather than a safe place to hide.
            </p>
          </Section>

          <Section title="3. You are measured against the market, not just on your number">
            <p>
              Your week shows two figures: what you made, and how that compares
              to the market as a whole. The second one is the honest one.
              Everybody is up in a week the market ran, and being up 2% in a
              week the market was up 3% is a bad week that looks like a good
              one.
            </p>
            <p>
              This is also what makes a falling week worth playing. Losing 1%
              while the market lost 4% is one of the better things you can do
              here, and the app says so.
            </p>
            <p>
              Home also shows <strong>what moved today</strong> — the largest
              real moves among companies you would recognise, and anything you
              hold. It is there because a screen that only shows two slowly
              moving numbers gives you no reason to open it on a Tuesday. It is
              not a shortlist and it is not advice: a big move is what happened,
              not a reason to buy anything.
            </p>
          </Section>

          <Section title="4. A league is where the game actually happens">
            <p>
              Playing alone is a spreadsheet. Two people is a game. When you
              sign up we make you a league of your own and give you a code —
              send it to somebody and you have a race.
            </p>
            <p>
              A league is private. Nobody can find it, and nobody can join it
              without the code. Inside it you see everybody&rsquo;s week, who is
              immediately ahead of you and by how much, and what anybody said
              they were going to do.
            </p>
            <p>
              You can also say, once a week, what you are trying to do — beat
              the market, finish up, finish top three, show up every day. It
              earns nothing and costs nothing. Saying a thing out loud to four
              people who will see whether you did it is the entire mechanic.
            </p>
          </Section>

          <Section title="5. Battles: the same market, a different rule book">
            <p>
              The ordinary week is buy anything, and after a while that is the
              same week every week. So a league can run a <strong>battle</strong>{" "}
              alongside it: a second contest with its own rules, its own length
              and its own scoreboard.
            </p>
            <p>
              Any member can start one, everybody in the league is in it,
              everybody starts level, and one runs at a time. Nothing about a
              battle touches your record, your streak or the season — it is
              between the people in it and nobody else.
            </p>

            <div className="grid gap-2 sm:grid-cols-2">
              {FORMATS.map((format) => (
                <div
                  key={format.id}
                  className="glass-well flex items-start gap-3 rounded-lg p-4"
                >
                  <span className="text-lg leading-none" aria-hidden="true">
                    {format.icon}
                  </span>
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-sm font-medium text-foreground">
                      {format.name}
                    </span>
                    <span className="text-sm">{format.rule}</span>
                  </span>
                </div>
              ))}
            </div>

            <p>
              And it runs for as long as the league decides. A day is a sprint;
              a year is a different game entirely, in which the person who
              fiddles the most usually loses.
            </p>

            <ul>
              {LENGTHS.map((length) => (
                <li key={length.id}>
                  <span className="text-foreground">{length.name}</span> —{" "}
                  {length.tagline}
                </li>
              ))}
            </ul>

            <p>
              Two of them are worth a sentence of their own.{" "}
              <strong>Upside down</strong> is short selling: you pick what will
              fall, and a position gains what the price loses. It has no
              borrowing and no leverage, and a name can never cost you more than
              you put into it, which is the one way it is kinder than the real
              thing. <strong>All hours</strong> is coins, and its market never
              shuts — it is the only contest here that runs on a Saturday.
            </p>

            <p>
              When a battle ends, everybody who was in it is told where they
              finished, and <strong>everybody&rsquo;s book is opened</strong> —
              what each of you was holding at the end and what it cost. Only
              then. While a contest is running, seeing the leader&rsquo;s
              positions would be a copying machine and a league would converge
              on one book by Wednesday; once it is settled, it is the
              conversation the whole thing was for.
            </p>
          </Section>

          <Section title="6. The weekend is for deciding, not for waiting">
            <p>
              The market shuts at 16:00 on Friday and opens at 09:30 on Monday.
              Nothing moves in between, so there is nothing to miss and nothing
              to check.
            </p>
            <p>
              What you can do is line up next week. Pick up to{" "}
              {MAX_LINEUP_ORDERS} companies over the weekend and they are bought
              for you at Monday&rsquo;s opening price. Everybody who leaves a
              lineup fills at that same price, so there is no advantage in doing
              it early, late, or in being awake at half past nine on Monday.
            </p>
            <p>
              It locks when the market opens, because from that moment the price
              is known and an order you could still change would be a trade
              placed with hindsight. Anything that could not be bought — no
              price, or no cash left by the time it came round — is left alone
              and says why.
            </p>
          </Section>

          <Section title="7. What keeps going underneath">
            <p>
              A <strong>streak</strong> counts days you opened Arena and looked
              at your week. It counts trading days only, so a weekend never
              breaks one, and it has nothing to do with how well you did.
            </p>
            <p>
              Your <strong>own record</strong> is on your profile: every week
              you have played, what you made, and how that compared to the
              market. Each of those was settled on the Friday it happened and
              has not been touched since.
            </p>
            <p>
              A <strong>season</strong> is a quarter of weeks, ranked on how far
              ahead of the market you finished per week rather than on how much
              you made in total — otherwise it would rank whoever showed up
              most. Play {MIN_WEEKS_TO_RANK} weeks of a quarter and you are
              placed in it.
            </p>
            <p>
              Everything you can earn — titles, flair, themes — is worn next to
              your name and affects no score. Nothing in Arena can be bought
              that changes a result, and nothing ever will be.
            </p>
          </Section>

          {/*
            What it will send you, on the page somebody reads before deciding
            whether to hand over an email address.

            It was not here at all, which is a strange omission on a page whose
            job is to say what this thing is: the honest answer is a reason to
            sign up rather than a thing to bury. The cap and the quiet hours
            are read from the module that enforces them, so this cannot become
            a promise that used to be true.
          */}
          <Section title="8. What Arena will send you, and what it will not">
            <p>
              Every one of them is something that actually happened, to you,
              with a name attached, and they are exactly the switches that sit
              on your profile:
            </p>
            {/*
              Drawn from the list the settings screen is built from, so this
              cannot end up describing a set of switches that no longer exists
              -- which is exactly what happened to this page's account of the
              game before battles were added to it.
            */}
            <ul>
              {KINDS.map((kind) => (
                <li key={kind.key}>
                  <span className="text-foreground">{kind.label}.</span>{" "}
                  {kind.detail}
                </li>
              ))}
            </ul>
            <p>
              Never more than {DAILY_CAP} in a day. Never between {QUIET_HOURS}{" "}
              where you are. Each one can be turned off on its own, and off
              means it stops that moment rather than at the end of some cycle.
            </p>
            <p>
              There is no &ldquo;come back&rdquo;, no &ldquo;your friends are
              playing without you&rdquo;, and no countdown invented to create a
              deadline. <strong>Nothing is ever sent about a bad week.</strong>{" "}
              Messaging a loss as something one more trade could fix is the
              mechanic behind chasing losses, and it is not going to be built
              here.
            </p>
          </Section>

          <Section title="9. How it is meant to be used">
            <p>
              Honestly: about a minute a day, and ten on a Sunday.
            </p>
            <ul>
              <li>
                <span className="text-foreground">Sunday.</span> Read how last
                week went, line up two or three companies for Monday, and start
                a battle if the ordinary week has gone stale.
              </li>
              <li>
                <span className="text-foreground">Monday.</span> Your lineup is
                bought at the open. Adjust it if you want to.
              </li>
              <li>
                <span className="text-foreground">Any weekday.</span> Open it
                once, see where you are, see who is immediately above you, and
                see what actually moved today. That is the whole visit.
              </li>
              <li>
                <span className="text-foreground">Friday.</span> The week is
                scored at the close and a card is made you can send to the
                people you were playing against.
              </li>
            </ul>
            <p>
              Arena is built so that a person who forgets about it for a week
              has lost nothing but that week. There are no timers you have to
              beat, nothing decays, and missing a day never costs you your place
              in a league.
            </p>
          </Section>

          <Section title="10. What Arena is not">
            <ul>
              <li>Not a broker, and not connected to any account you hold.</li>
              <li>Not real money, in or out, at any point.</li>
              <li>Not advice. Nothing here is a recommendation to buy anything.</li>
              <li>
                Not a prediction. Prices are delayed, and a week of picking
                winners with pretend money tells you very little about picking
                them with real money.
              </li>
              <li>
                Not gambling for prizes. There is no stake, no payout and
                nothing to win but the argument.
              </li>
            </ul>
          </Section>

          <div className="flex flex-col gap-3 border-t border-border pt-8 text-sm text-muted-foreground">
            <p>
              <Link href="/" className="text-foreground underline underline-offset-4">
                Start playing
              </Link>{" "}
              &middot;{" "}
              <Link
                href="/legal/terms"
                className="text-foreground underline underline-offset-4"
              >
                Terms
              </Link>{" "}
              &middot;{" "}
              <Link
                href="/legal/privacy"
                className="text-foreground underline underline-offset-4"
              >
                Privacy
              </Link>
            </p>
            <p>
              Not financial advice. Questions:{" "}
              <a
                href="mailto:app.support@upthink.ee"
                className="text-foreground underline underline-offset-4"
              >
                app.support@upthink.ee
              </a>
              .
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <div
        className="flex flex-col gap-4 text-sm leading-relaxed text-muted-foreground
          [&_li]:ml-5 [&_li]:list-disc [&_strong]:font-semibold [&_strong]:text-foreground
          [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-2"
      >
        {children}
      </div>
    </section>
  );
}
