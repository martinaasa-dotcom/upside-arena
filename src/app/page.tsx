import Link from "next/link";
import { Trophy, Users } from "lucide-react";
import { ArenaWordmark } from "@/components/brand/ArenaWordmark";
import { SignInCard } from "@/components/SignInCard";
import { Badge } from "@/components/ui/badge";
import { isGoogleEnabled } from "@/lib/env";
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

/** A league at Friday's close. Fixed numbers, labelled as a sample. */
const SAMPLE = [
  { rank: 1, name: "Sarah", value: "+4.2%", tone: "gain" as const },
  { rank: 2, name: "You", value: "+3.8%", tone: "gain" as const },
  { rank: 3, name: "Marcus", value: "+1.1%", tone: "gain" as const },
  { rank: 4, name: "Priya", value: "-0.6%", tone: "loss" as const },
];

export default async function LandingPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;

  return (
    <div className="page-frame">
      <main
        id="main"
        className="relative mx-auto flex w-full max-w-6xl flex-col justify-center px-6 py-[max(1.75rem,env(safe-area-inset-top))] md:py-[max(2.5rem,env(safe-area-inset-top))] pb-[max(16rem,env(safe-area-inset-bottom))] md:min-h-dvh md:pb-[max(3.5rem,env(safe-area-inset-bottom))]"
      >
        <div className="grid items-center gap-10 md:grid-cols-[minmax(0,1fr)_20rem] md:gap-14 lg:gap-20">
          <div className="flex flex-col items-center text-center md:items-start md:text-left">
            <ArenaWordmark className="rise rise-1" />

            <div className="rise rise-2 mt-8 flex max-w-lg flex-col gap-4 md:mt-10 md:gap-5">
              <h1 className="text-2xl leading-tight font-semibold tracking-tight text-balance">
                Pick stocks with friends. Play money only.
              </h1>
              <p className="text-base leading-relaxed text-muted-foreground">
                You get pretend money, you pick real companies, and on Friday
                you find out who did best. Nothing real is ever at stake.
              </p>
            </div>

            <ul className="rise rise-2 mt-7 flex max-w-md flex-col gap-4 text-left text-sm leading-relaxed text-muted-foreground md:mt-9">
              {POINTS.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-start gap-3.5">
                  <span
                    className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/15"
                    aria-hidden="true"
                  >
                    <Icon className="size-4" />
                  </span>
                  <span className="pt-1.5">{text}</span>
                </li>
              ))}
            </ul>

            <div className="rise rise-3 mt-8 w-full max-w-sm md:mt-10">
              <SignInCard
                googleEnabled={isGoogleEnabled}
                next={next}
                initialError={
                  error === "age"
                    ? `You need to be ${MINIMUM_AGE} or older to play.`
                    : undefined
                }
              />
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
      {/* One quiet warm lift behind the card, not a halo. */}
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
