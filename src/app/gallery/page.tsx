import { notFound } from "next/navigation";
import { Panel } from "@/components/Panel";
import { SeasonTable } from "@/components/SeasonTable";
import { StandingsTable } from "@/components/StandingsTable";
import { StreakCard } from "@/components/StreakCard";
import { Holdings } from "@/components/Holdings";
import { PodStandings } from "@/components/PodStandings";
import { CoinShop } from "@/components/CoinShop";
import { Wardrobe } from "@/components/Wardrobe";
import { WeekRecap } from "@/components/WeekRecap";
import { COIN_BUNDLES } from "@/lib/billing/plan";
import { PAGE, STACK } from "@/lib/page-shell";
import * as fixture from "./fixtures";

/*
  Every component that lays out somebody else's data, on one page, holding the
  widest values it will ever be given.

  This exists because four layout faults shipped in a row that no test could
  see: a fixed-height row that cropped its own second line, a figure that
  wrapped into the row below it, two descriptions truncated to nothing. All
  four rendered without an error, passed every unit test, and were only
  visible to a person holding a phone. They are all the same fault — an
  element smaller than what is inside it — and a browser can be asked that
  question directly. tests/e2e/clipping.spec.ts asks it, of everything here,
  at every width a phone reports.

  It is also what a design pass should be read on, instead of the throwaway
  scaffolds that got hand-built twice for the same purpose.

  Not a route in production. ARENA_UI_GALLERY is set by the Playwright web
  server and by `npm run gallery`, and nowhere a deployment can read it.
  Without it two separate things refuse: the proxy does not count /gallery
  among the public paths, so a signed-out visitor is sent to sign in, and the
  page itself answers 404 to anybody who gets past that with a session. Both
  were checked against a production build rather than reasoned about.
*/
export const dynamic = "force-dynamic";

export const metadata = { title: "Gallery", robots: { index: false, follow: false } };

function Case({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <section data-case={name} className="flex flex-col gap-2">
      <h2 className="text-xs uppercase tracking-wide text-muted-foreground">{name}</h2>
      {children}
    </section>
  );
}

export default function GalleryPage() {
  if (!process.env.ARENA_UI_GALLERY) notFound();

  return (
    <div className={`${PAGE} ${STACK}`}>
      <h1>Gallery</h1>

      <Case name="season-table">
        <Panel title="Season">
          <SeasonTable standings={fixture.seasonStandings} />
        </Panel>
      </Case>

      <Case name="standings-table">
        <Panel title="League">
          <StandingsTable standings={fixture.leagueStandings} goalFor={fixture.goalFor} />
        </Panel>
      </Case>

      <Case name="streak-running">
        <StreakCard streak={fixture.streak} />
      </Case>

      <Case name="streak-done">
        <StreakCard streak={fixture.streakDone} />
      </Case>

      <Case name="holdings">
        <Panel title="Holdings">
          <Holdings positions={fixture.positions} />
        </Panel>
      </Case>

      <Case name="pod-climbing">
        <PodStandings view={fixture.podView} />
      </Case>

      <Case name="pod-dropping">
        <PodStandings view={fixture.podViewDropping} />
      </Case>

      <Case name="week-recap">
        <WeekRecap recap={fixture.recap} />
      </Case>

      <Case name="coin-shop">
        <Panel title="Coins">
          <CoinShop
            bundles={COIN_BUNDLES}
            onSale={[
              {
                id: "c1",
                name: "Aurora flair",
                description:
                  "A slow shifting outline on your name, everywhere it appears in the game.",
                kind: "flair",
                coinPrice: 1200,
                plusOnly: false,
                styleKey: "aurora",
              },
            ]}
            memberOnly={[
              {
                id: "c2",
                name: "Midnight theme",
                description:
                  "The whole app a shade darker, for people who play after everyone else has gone to bed.",
                kind: "theme",
                coinPrice: null,
                plusOnly: true,
                styleKey: "midnight",
              },
            ]}
            balance={1_234_567}
            hasPlus={false}
            canBuy
          />
        </Panel>
      </Case>

      <Case name="wardrobe">
        <Panel title="Wardrobe">
          <Wardrobe
            wardrobe={{
              owned: [
                {
                  id: "w1",
                  name: "Seven days running",
                  description:
                    "Earned by turning up seven trading days in a row without missing one.",
                  kind: "title",
                  styleKey: null,
                  earnedAt: "2026-08-01",
                  equipped: true,
                },
              ],
              locked: [
                {
                  id: "w2",
                  name: "One hundred days running",
                  description:
                    "Earned by turning up a hundred trading days in a row, which is most of a year of weekdays.",
                  kind: "title",
                  streakRequired: 100,
                },
              ],
              forSale: [],
              equipped: { title: "w1", flair: null, theme: null },
            }}
          />
        </Panel>
      </Case>
    </div>
  );
}
