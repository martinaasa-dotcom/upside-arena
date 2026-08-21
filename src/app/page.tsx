import Link from "next/link";
import { Flame, Trophy, Users } from "lucide-react";
import { ArenaWordmark } from "@/components/brand/ArenaWordmark";
import { SignInCard } from "@/components/SignInCard";
import { Badge } from "@/components/ui/badge";
import { PAGE, PAGE_FRAME } from "@/lib/page-shell";
import { isGoogleEnabled } from "@/lib/env";
import { BOX, CARD } from "@/lib/page-shell";

const POINTS = [
  {
    icon: Users,
    text: "Start a league, invite your friends, and see who picks best this week.",
  },
  {
    icon: Trophy,
    text: "Everyone starts the week with the same play money, so it is a fair race.",
  },
  {
    icon: Flame,
    text: "Check in each day to keep your streak going.",
  },
];

/** Standing in a sample league. Fixed numbers, clearly labelled as a sample. */
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
    <div className={PAGE_FRAME}>
      <main id="main" className={`${PAGE} flex min-h-dvh items-center py-16`}>
        <div className="grid w-full gap-12 lg:grid-cols-2 lg:gap-16">
          <div className="flex flex-col justify-center">
            <ArenaWordmark className="mb-8" />

            <h1 className="max-w-lg text-3xl leading-tight font-semibold tracking-tight sm:text-4xl">
              Pick stocks with friends. Play money only.
            </h1>

            <p className="mt-4 max-w-md text-muted-foreground">
              A free weekly game. You get pretend money, you pick real companies, and
              you find out on Friday who did best. Nothing real is ever at stake.
            </p>

            <ul className="mt-8 flex flex-col gap-4">
              {POINTS.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-start gap-3">
                  <span className="glass-well flex size-8 shrink-0 items-center justify-center rounded-lg">
                    <Icon className="size-4 text-primary" aria-hidden="true" />
                  </span>
                  <span className="pt-1.5 text-sm text-muted-foreground">{text}</span>
                </li>
              ))}
            </ul>

            <div className="mt-10 max-w-sm">
              <SignInCard
                googleEnabled={isGoogleEnabled}
                next={next}
                initialError={
                  error === "age" ? "You need to be 16 or older to play." : undefined
                }
              />
            </div>

            <p className="mt-6 max-w-md text-sm text-muted-foreground">
              By continuing you agree to the{" "}
              <Link href="/legal/terms" className="text-foreground underline underline-offset-4">
                Terms
              </Link>{" "}
              and{" "}
              <Link href="/legal/privacy" className="text-foreground underline underline-offset-4">
                Privacy policy
              </Link>
              .
              <br />
              Not financial advice. Help:{" "}
              <a
                href="mailto:app.support@upthink.ee"
                className="text-foreground underline underline-offset-4"
              >
                app.support@upthink.ee
              </a>
              .
            </p>
          </div>

          {/* Sample standing, so a signed-out visitor can see the game before joining. */}
          <div className="flex items-center justify-center">
            <div className={`${BOX} w-full max-w-sm`}>
              <div className="mb-4 flex items-center justify-between gap-3">
                <span className="text-sm text-muted-foreground">Friday close</span>
                <Badge variant="outline">Sample</Badge>
              </div>

              <p className="text-sm text-muted-foreground">Sunday Roasters</p>
              <p className="figure mt-1 text-2xl font-bold">$10,380</p>
              <p className="figure mt-1 text-sm text-gain">+3.8% this week</p>

              <div className="mt-5 flex flex-col gap-2">
                {SAMPLE.map((row) => (
                  <div
                    key={row.rank}
                    className={`${CARD} flex h-10 items-center gap-3 py-0`}
                  >
                    <span className="figure w-5 text-sm text-muted-foreground">
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

              <p className="mt-4 text-sm text-muted-foreground">
                You are 0.4% behind Sarah. One good day closes that.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
