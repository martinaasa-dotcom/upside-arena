import { Suspense } from "react";
import Link from "next/link";
import { Trophy, Users } from "lucide-react";
import { ArenaWordmark } from "@/components/brand/ArenaWordmark";
import { SignInCard } from "@/components/SignInCard";
import { Badge } from "@/components/ui/badge";
import { googleConfigured } from "@/lib/auth/google";
import { COMPANY } from "@/lib/company";
import { MINIMUM_AGE } from "@/lib/legal";

/*
  The signed-out page.

  Laid out the way Upside Lab's is: a narrow column of words with a fixed,
  narrow sample beside it, rather than two equal halves. Two equal halves make
  the text stretch and the sample squat, and the page reads as a form rather
  than an invitation.
*/

const POINTS = [
  {
    icon: Users,
    text: "Start a league, invite your friends, and see who picks best this week.",
  },
  {
    icon: Trophy,
    text: "Everyone starts Monday with the same play money, so it is a fair race.",
  },
];

/*
  The one part of this page that is not the same for everybody.

  googleConfigured is called here rather than read from module scope, so what
  it reports is what this server holds now. Read at module scope it would have
  been read while the page was being built, and a credential present only at
  runtime would have hidden the button for the life of the deployment with
  nothing to say why.
*/
async function SignIn({ searchParams }: { searchParams: Search }) {
  const { next, error } = await searchParams;

  return (
    <SignInCard
      googleEnabled={googleConfigured()}
      next={next}
      initialError={
        error === "age"
          ? `You need to be ${MINIMUM_AGE} or older to play.`
          : undefined
      }
    />
  );
}

/** A league at Friday's close. Fixed numbers, labelled as a sample. */
const SAMPLE = [
  { rank: 1, name: "Sarah", value: "+4.2%", tone: "gain" as const },
  { rank: 2, name: "You", value: "+3.8%", tone: "gain" as const },
  { rank: 3, name: "Marcus", value: "+1.1%", tone: "gain" as const },
  { rank: 4, name: "Priya", value: "-0.6%", tone: "loss" as const },
];

type Search = Promise<{ next?: string; error?: string }>;

/*
  The signed-out page, prerendered except for the one part that cannot be.

  Everything here is the same for everybody: the wordmark, the headline, the
  two points, the sample league, the legal line. The only thing that depends
  on the request is the sign-in card, which needs the `next` the proxy put in
  the URL, the age error if there is one, and whether Google sign-in is
  configured on this deployment. So that card, and nothing else, waits.

  This is the page every new visitor lands on. It now arrives as HTML from a
  CDN with the card filling in, rather than being rendered from scratch for
  each of them.
*/
export default function LandingPage({
  searchParams,
}: {
  searchParams: Search;
}) {
  return (
    <div className="page-frame">
      <main
        id="main"
        className="relative mx-auto flex w-full max-w-6xl flex-col justify-center px-6 py-[max(1.75rem,env(safe-area-inset-top))] md:py-[max(2.5rem,env(safe-area-inset-top))] pb-[max(16rem,env(safe-area-inset-bottom))] md:min-h-dvh md:pb-[max(3.5rem,env(safe-area-inset-bottom))]"
      >
        <div className="grid items-center gap-10 md:grid-cols-[minmax(0,1fr)_20rem] md:gap-14 lg:gap-20">
          <div className="flex flex-col items-center text-center md:items-start md:text-left">
            <ArenaWordmark className="rise rise-1" size={44} />

            <div className="rise rise-2 mt-8 flex max-w-lg flex-col gap-4 md:mt-10 md:gap-5">
              <h1 className="text-2xl leading-tight font-semibold tracking-tight text-balance">
                Pick stocks with friends. Play money only.
              </h1>
              <p className="text-base leading-relaxed text-muted-foreground">
                You get pretend money, you pick real companies, and on Friday
                you find out who did best. Nothing real is ever at stake.
              </p>
              {/*
                The rules, before the sign-in box rather than after it.

                Somebody deciding whether to hand over an email address to a
                thing involving share prices has one question, and it is "what
                is this". Two lines and a headline is the answer for most of
                them; this is for the rest, and it is readable without an
                account on purpose.
              */}
              <p className="text-sm leading-relaxed text-muted-foreground">
                <Link
                  href="/how"
                  className="text-foreground underline underline-offset-4"
                >
                  How Arena works
                </Link>{" "}
                — the whole game in two minutes, no account needed.
              </p>
            </div>

            <ul className="rise rise-2 mt-7 flex max-w-md flex-col gap-4 text-left text-sm leading-relaxed text-muted-foreground md:mt-9">
              {POINTS.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-start gap-3.5">
                  {/*
                    The badge is centred on the first line rather than nudged
                    with margins. The wrapper is exactly one line box tall
                    (1.625em at this text size), so centring the larger badge
                    inside it lets it overhang evenly above and below. Two
                    hand-tuned offsets used to do this job and left the badge
                    sitting low against the text.
                  */}
                  <span
                    className="flex h-[1.625em] shrink-0 items-center"
                    aria-hidden="true"
                  >
                    <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/15">
                      <Icon className="size-4" />
                    </span>
                  </span>
                  <span>{text}</span>
                </li>
              ))}
            </ul>

            <div className="rise rise-3 mt-8 w-full max-w-sm md:mt-10">
              {/*
                The fallback is the card's own resting height, so the legal
                line under it and the sample beside it do not move when the
                real one arrives.
              */}
              <Suspense fallback={<div className="h-[7.5rem]" aria-hidden="true" />}>
                <SignIn searchParams={searchParams} />
              </Suspense>
            </div>

            {/*
              Age is asserted here, in the same sentence as the terms, rather
              than behind its own tick box. Lab moved away from a checkbox for
              a reason worth repeating: it is a thing to get past rather than a
              thing anyone reads, and it puts a dead button in front of every
              new person. Continuing is the affirmative act, and it is recorded.
            */}
            <p className="rise rise-4 mt-6 max-w-sm text-sm leading-relaxed text-muted-foreground">
              By continuing you confirm you are {MINIMUM_AGE} or older and agree
              to the{" "}
              <Link href="/legal/terms" className="underline underline-offset-4 hover:text-foreground">
                Terms
              </Link>{" "}
              and{" "}
              <Link href="/legal/privacy" className="underline underline-offset-4 hover:text-foreground">
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

          <SampleLeague />
        </div>
      </main>
    </div>
  );
}

/** A small still of a finished week. Not a full-size Home panel. */
function SampleLeague() {
  return (
    <div className="relative mx-auto w-full max-w-sm md:-rotate-1 md:transition-transform md:duration-700 md:hover:rotate-0">
      {/* One quiet lift behind the card, not a halo. */}
      <div
        className="pointer-events-none absolute -inset-2 -z-10 rounded-[2.5rem] bg-gradient-to-br from-primary/12 to-transparent opacity-70 blur-2xl"
        aria-hidden="true"
      />

      <div className="card-sheen glass rise rise-3 relative overflow-hidden rounded-xl p-4 shadow-2xl shadow-black/60 ring-1 ring-primary/15">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-24 bg-gradient-to-b from-white/[0.06] to-transparent"
          aria-hidden="true"
        />

        <div className="mb-3 flex items-center justify-between gap-3">
          <span className="text-sm text-muted-foreground">Friday close</span>
          <Badge variant="outline">Sample</Badge>
        </div>

        <p className="text-sm text-muted-foreground">Sunday Roasters</p>
        <p className="figure mt-1 text-2xl font-bold">$103,800</p>
        <p className="figure mt-1 text-sm text-gain">+3.8% this week</p>

        <div className="mt-4 flex flex-col gap-1.5">
          {SAMPLE.map((row) => (
            <div
              key={row.rank}
              className="glass-well flex h-10 items-center gap-3 rounded-lg px-3"
            >
              <span className="figure w-4 text-xs text-muted-foreground">
                {row.rank}
              </span>
              <span className="flex-1 truncate text-sm">{row.name}</span>
              <span
                className={`figure text-sm ${
                  row.tone === "gain" ? "text-gain" : "text-loss"
                }`}
              >
                {row.value}
              </span>
            </div>
          ))}
        </div>

        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          You are 0.4% behind Sarah. One good day closes that.
        </p>
      </div>
    </div>
  );
}
