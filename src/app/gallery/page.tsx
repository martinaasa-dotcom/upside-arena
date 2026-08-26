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
import { Ticker } from "@/components/Ticker";
import { WeeklyGoal, GoalMark } from "@/components/WeeklyGoal";
import { BattleCard } from "@/components/BattleCard";
import { DraftCard } from "@/components/DraftCard";
import { DraftBoard, DraftRunningOrder } from "@/components/DraftRoom";
import { StartBattleForm } from "@/components/StartBattleForm";
import { Lineup, LineupReport } from "@/components/Lineup";
import {
  FormStrip,
  HeadToHeadTable,
  HonoursBoard,
  PlayedWeeks,
  WeekLog,
} from "@/components/LeagueRecord";
import { Movers } from "@/components/Movers";
import { FirstRun } from "@/components/FirstRun";
import { Case } from "./Case";
import { TourCases } from "./TourCases";
import { Scoreboard, Score } from "@/components/Scoreboard";
import { InviteCode } from "@/components/InviteCode";
import { CreateLeagueForm, JoinLeagueForm } from "@/components/LeagueForms";
import { NotificationSettings } from "@/components/NotificationSettings";
import { PlusControls } from "@/components/PlusControls";
import { AccountControls } from "@/components/AccountControls";
import { SignInAddresses } from "@/components/SignInAddresses";
import { SharedCards } from "@/components/SharedCards";
import { WeekShape } from "@/components/WeekShape";
import { Trail } from "@/components/Trail";
import { Reveal, revealTitle } from "@/components/Reveal";
import { TradeForm } from "@/components/TradeForm";
import { allowedSymbols, formatById } from "@/lib/game/formats";
import { settledWeek, weekSoFar } from "@/lib/game/shape";
import { AppHeader } from "@/components/AppHeader";
import { BottomDock } from "@/components/BottomDock";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { priceAgeLabel } from "@/lib/format";
import { ErrorPreview } from "./ErrorPreview";
import { COIN_BUNDLES } from "@/lib/billing/plan";
import { COLUMN, PAGE, SPLIT, STACK } from "@/lib/page-shell";
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

export const metadata = { title: "Gallery", robots: { index: false, follow: false } };

export default function GalleryPage() {
  if (!process.env.ARENA_UI_GALLERY) notFound();

  return (
    <div className={`${PAGE} ${STACK}`}>
      {/*
        The chrome, which is the one part of the app that had never been in
        here.

        It lives behind a sign-in, so nothing signed-out could render it and
        no browser test had ever laid eyes on it. dock.spec.ts works around
        that by rebuilding the dock's markup by hand and measuring the copy.
        This is the real thing, so the clipping probe reads it at every width
        a phone reports, along with everything else on this page -- and the
        fault the dock has actually shipped is running off the side of a
        narrow screen, which is exactly what that probe is looking for.

        Deliberately not wrapped in <Case>. The header is sticky and the dock
        is fixed, so neither takes up room in the flow, and a <Case> around
        them measures nothing but its own heading. That would fail the check
        that every case drew something, and that check is worth more than the
        two entries: it is what stops a gallery of empty shells passing
        everything. So they sit here instead, out of the inventory and still
        in front of the probe.
      */}
      <AppHeader />
      <BottomDock
        me={
          <Avatar className="size-7 rounded-full text-xs">
            <AvatarFallback>UA</AvatarFallback>
          </Avatar>
        }
      />

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

      <Case name="pod-settled">
        <PodStandings view={fixture.podViewSettled} />
      </Case>

      <Case name="week-recap">
        <WeekRecap recap={fixture.recap} />
      </Case>

      <Case name="week-recap-ahead-of-falling-market">
        <WeekRecap recap={fixture.recapAheadOfFallingMarket} />
      </Case>

      <Case name="week-recap-bad-week">
        <WeekRecap recap={fixture.recapBadWeek} />
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

      <Case name="ticker">
        <Scoreboard>
          <Score label="Portfolio" value={<Ticker value={1_284_913.55} format="money" />} />
          <Score label="This week" value={<Ticker value={-12.47} format="percent" />} />
          <Score
            label="Ahead of the market by"
            value={<Ticker value={128.4} format="percent" />}
          />
        </Scoreboard>
      </Case>

      {/*
        The table with no day in it. Reasoned about when the day column was
        added and never actually looked at, which is the same way the reveal
        shipped saying the wrong thing about somebody who never traded.
      */}
      <Case name="standings-table-no-day">
        <Panel title="A battle, which has no day to show">
          <StandingsTable standings={fixture.battleStandings} />
        </Panel>
      </Case>

      <Case name="week-shape-all-down">
        <Panel title="A week that never got above water">
          <WeekShape days={settledWeek([-0.6, -2.1, -1.4, -3.8, -3.1])} />
        </Panel>
      </Case>

      <Case name="reveal">
        <Panel
          title={revealTitle(fixture.revealedBooks)}
          description="What everybody was holding at the end, and what it cost them. Shown now that it is over and nobody can copy it."
        >
          <Reveal books={fixture.revealedBooks} />
        </Panel>
      </Case>

      <Case name="trail-quarter">
        <Panel
          title="How it has gone"
          description="Each point is a day's close. The line across the middle is what everybody started with."
        >
          <Trail values={fixture.quarterTrail} from="17 August" to="Now" />
        </Panel>
      </Case>

      <Case name="trail-behind">
        <Panel title="How it has gone">
          <Trail values={fixture.losingTrail} from="17 August" to="Now" />
        </Panel>
      </Case>

      <Case name="trail-short">
        <Panel title="How it has gone">
          <Trail values={[0, 1.4, 0.9, 2.6]} from="17 August" to="Now" />
        </Panel>
      </Case>

      <Case name="week-shape">
        <Panel title="The week">
          <WeekShape days={settledWeek(fixture.weekMarks)} />
        </Panel>
      </Case>

      <Case name="week-shape-joined-midweek">
        <Panel title="A week someone joined on the Wednesday">
          <WeekShape days={settledWeek(fixture.joinedMidweekMarks)} />
        </Panel>
      </Case>

      <Case name="week-shape-flat">
        <Panel title="A week that barely moved">
          <WeekShape days={settledWeek(fixture.flatMarks)} />
        </Panel>
      </Case>

      <Case name="week-so-far">
        <Panel
          title="Your week so far"
          description="Each bar is where the week stood at that day's close. The outlined one is today, and it can still move."
        >
          <WeekShape
            days={weekSoFar({
              monday: fixture.partWeekMonday,
              marks: fixture.partWeekMarks,
              today: fixture.partWeekToday,
              liveReturnPercent: fixture.partWeekLive,
            })}
          />
        </Panel>
      </Case>

      <Case name="week-so-far-behind">
        <Panel
          title="Your week so far"
          description="Each bar is where the week stood at that day's close. The outlined one is today, and it can still move."
        >
          <WeekShape
            days={weekSoFar({
              monday: fixture.partWeekMonday,
              marks: fixture.partWeekMarks,
              today: fixture.partWeekToday,
              liveReturnPercent: -3.1,
            })}
          />
        </Panel>
      </Case>

      <Case name="weekly-goal-open">
        <WeeklyGoal leagueId="l1" declared={null} />
      </Case>

      <Case name="weekly-goal-declared">
        <WeeklyGoal leagueId="l1" declared="beat_market" />
      </Case>

      <Case name="goal-marks">
        <Panel title="Goal marks">
          <div className="flex flex-col gap-2">
            <GoalMark label="Beat the market by 5% without selling anything" met={null} />
            <GoalMark label="Beat the market by 5% without selling anything" met={true} />
            <GoalMark label="Beat the market by 5% without selling anything" met={false} />
          </div>
        </Panel>
      </Case>

      {/*
        Battles and the weekend, which are the two widest things on this page.

        The format picker is twelve cards of two lines each, the lineup rows
        carry a company name against a five-figure estimate, and the first-week
        list is four rows of a heading over a paragraph. All three are exactly
        the shape that cropped its own second line the last four times.
      */}
      <Case name="battle-running">
        <BattleCard battle={fixture.battle} href="#" />
      </Case>

      <Case name="battle-not-started">
        <BattleCard battle={fixture.battleNotStarted} href="#" />
      </Case>

      <Case name="battle-finished">
        <BattleCard
          battle={fixture.battleFinished}
          href="#"
          result={{ rank: 3, players: 12, returnPercent: -2.4 }}
        />
      </Case>

      {/*
        Draft night, which is the widest thing on this page after the format
        picker.

        The board is twenty-four tiles carrying a cashtag, a price and a
        company name, and the names are the real ones: "Taiwan Semiconductor
        Manufacturing Company Limited" under a five-figure price is what
        decides whether a tile crops, and it is fine at 1440 by definition.

        The room itself is not here on purpose. It polls, and a polling
        component in the inventory would fire a server action every two seconds
        against a draft that does not exist, so the two pieces worth measuring
        are drawn without it.
      */}
      <Case name="draft-card-picking">
        <DraftCard
          draft={fixture.draftRow}
          format={fixture.draftShell.format}
          seats={4}
          href="#"
          youAreSeated
        />
      </Case>

      <Case name="draft-card-waiting">
        <DraftCard
          draft={fixture.draftRowWaiting}
          format={fixture.draftShell.format}
          seats={1}
          href="#"
          youAreSeated={false}
        />
      </Case>

      <Case name="draft-board">
        <DraftBoard
          shell={fixture.draftShell}
          state={fixture.draftState}
          yourTurn={false}
          picking={null}
        />
      </Case>

      <Case name="draft-running-order">
        <DraftRunningOrder shell={fixture.draftShell} state={fixture.draftState} />
      </Case>

      {/*
        The form every trade in the game goes through, which had never been
        drawn here.

        Three shapes, and the middle one is the reason: a format that names
        its companies gets a grid of them instead of a search box, and
        twenty-four tiles is the sort of thing that is fine at 1440 and a
        column of rubble at 390.
      */}
      <Case name="trade-form">
        <Panel title="Trade">
          <TradeForm cash={41_284.5} ownedSymbols={["AAPL", "NVDA"]} tradingOpen closedReason="" />
        </Panel>
      </Case>

      <Case name="trade-form-named-universe">
        <Panel title="Trade">
          <TradeForm
            cash={100_000}
            ownedSymbols={[]}
            tradingOpen
            closedReason=""
            battleId="b1"
            universe={allowedSymbols(formatById("silicon"))}
            rule={formatById("silicon").rule}
          />
        </Panel>
      </Case>

      <Case name="trade-form-closed">
        <Panel title="Trade">
          <TradeForm
            cash={100_000}
            ownedSymbols={[]}
            tradingOpen={false}
            closedReason="The market is shut. It opens at 09:30 in New York, which is half past two here."
          />
        </Panel>
      </Case>

      <Case name="start-battle">
        <StartBattleForm leagueId="l1" />
      </Case>

      <Case name="lineup">
        <Lineup view={fixture.lineup} />
      </Case>

      <Case name="lineup-locked">
        <Lineup view={fixture.lineupLocked} />
      </Case>

      <Case name="lineup-report">
        <LineupReport filled={2} missed={fixture.lineupMissed} />
      </Case>

      <TourCases />

      <Case name="first-week">
        <FirstRun
          startingBalance={100_000}
          leagueName={fixture.LONG_LEAGUE}
          inviteCode="ABCD2345"
          leagueHref="#"
          hasTraded={false}
          hasCompany={false}
          hasGoal={false}
          hasBattle={false}
        />
      </Case>

      <Case name="first-week-part-done">
        <FirstRun
          startingBalance={100_000}
          leagueName={fixture.LONG_LEAGUE}
          inviteCode="ABCD2345"
          leagueHref="#"
          hasTraded
          hasCompany
          hasGoal={false}
          hasBattle={false}
        />
      </Case>

      {/*
        What a league remembers. The strip is five cells across a phone, the
        board carries a name against two figures, and the head-to-head puts a
        scoreline where the figures usually are -- three different ways for a
        row to run out of room.
      */}
      {/*
        The two-column room, which is the shape every screen actually ships in
        on a wide display.

        Worth a case of its own rather than trusting the panels above it. Each
        one measured on its own gets the whole page width, which is not a width
        any of them is ever drawn at once there is something beside it -- and a
        row that reads fine at 1150px can be the one that wraps at 700.
      */}
      <Case name="room-split">
        <div className={SPLIT}>
          <div className={COLUMN}>
            <Panel title="This week" description="Everyone started Monday with the same money.">
              <StandingsTable standings={fixture.leagueStandings} />
            </Panel>
            <Panel title="Weeks won">
              <HonoursBoard honours={fixture.honours} />
            </Panel>
          </div>
          <div className={COLUMN}>
            <Panel title="You against each of them">
              <HeadToHeadTable rows={fixture.headToHead} />
            </Panel>
            <Panel title="What you own">
              <Holdings positions={fixture.positions} />
            </Panel>
          </div>
        </div>
      </Case>

      {/*
        The charts at the width they are actually drawn at.

        Both of these were measured on their own, which gave them the whole
        page -- and neither is ever drawn there. A line and a row of bars are
        exactly the components whose readability is a function of how wide
        they are, so they want a case inside the room they ship in.
      */}
      <Case name="room-split-charts">
        <div className={SPLIT}>
          <div className={COLUMN}>
            <Panel
              title="Your week so far"
              description="Each bar is where the week stood at that day's close. The outlined one is today, and it can still move."
              action={
                <span className="figure flex items-baseline gap-1.5 text-sm">
                  <span className="text-muted-foreground">Today</span>
                  <span className="text-gain">+0.8%</span>
                </span>
              }
            >
              <WeekShape
                days={weekSoFar({
                  monday: fixture.partWeekMonday,
                  marks: fixture.partWeekMarks,
                  today: fixture.partWeekToday,
                  liveReturnPercent: fixture.partWeekLive,
                })}
              />
              <p className="text-sm text-muted-foreground">
                Up <span className="figure">$812</span> since last night&rsquo;s close.
              </p>
            </Panel>

            <Panel
              title="How it has gone"
              description="Each point is a day's close. The line across the middle is what everybody started with."
            >
              <Trail values={fixture.quarterTrail} from="17 August" to="Now" />
            </Panel>
          </div>

          <div className={COLUMN}>
            <Panel title="The table">
              <StandingsTable standings={fixture.leagueStandings} />
            </Panel>
            <Panel title="What you own">
              <Holdings positions={fixture.positions} />
            </Panel>
          </div>
        </div>
      </Case>

      {/*
        The first week's room, at the width where the two columns are not two
        columns.

        Home puts "what to do next" in the second column, and on a phone a
        second column is not beside the first, it is after all of it. For one
        week that ordering is wrong, so that column takes order-first below
        lg -- and a class that only does anything at one breakpoint is exactly
        the sort of claim worth photographing rather than believing.
      */}
      <Case name="room-split-first-week">
        <div className={SPLIT}>
          <div className={COLUMN}>
            <Panel title="What you own" description="Nothing yet. Your money is all sitting in cash, which earns nothing." />
            <Movers movers={fixture.movers} />
          </div>

          <div className={`${COLUMN} max-lg:order-first`}>
            <FirstRun
              startingBalance={100_000}
              leagueName={fixture.LONG_LEAGUE}
              inviteCode="ABCD2345"
              leagueHref="#"
              hasTraded={false}
              hasCompany={false}
              hasGoal={false}
              hasBattle={false}
            />
          </div>
        </div>
      </Case>

      <Case name="form-strip">
        <FormStrip weeks={fixture.recordedWeeks} you={fixture.honours[1]} href="#" />
      </Case>

      <Case name="honours-board">
        <Panel title="Weeks won">
          <HonoursBoard honours={fixture.honours} />
        </Panel>
      </Case>

      <Case name="head-to-head">
        <Panel title="You against each of them">
          <HeadToHeadTable rows={fixture.headToHead} />
        </Panel>
      </Case>

      <Case name="week-log">
        <Panel title="Every week">
          <WeekLog weeks={fixture.recordedWeeks} />
        </Panel>
      </Case>

      {/*
        A league row on the index. Four things compete for one row: an icon, a
        name long enough to need truncating, a battle badge, and a placing --
        which is the row most likely to run out of width on a phone, and the
        reason the badge is held back until there is room for it.
      */}
      <Case name="league-row">
        <Panel title="Your leagues">
          <div className="flex flex-col gap-2">
            <span className="glass-well flex min-h-16 items-center gap-3 rounded-lg px-4 py-2">
              <span className="shrink-0 text-lg" aria-hidden="true">
                {"\u{1F3C6}"}
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-sm font-medium">
                  {fixture.LONG_LEAGUE}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  Aleksandra Wiśniewska-Rodríguez is top
                </span>
              </span>
              <Badge variant="outline" className="hidden shrink-0 sm:inline-flex">
                <span aria-hidden="true">{"\u{1F9E0}"}</span>
                Silicon
              </Badge>
              <span className="flex shrink-0 flex-col items-end">
                <span className="figure text-sm font-semibold">12th of 20</span>
                <span className="figure text-xs text-loss">-128.5%</span>
              </span>
            </span>

            <span className="glass-well flex min-h-16 items-center gap-3 rounded-lg px-4 py-2">
              <span className="shrink-0 text-lg" aria-hidden="true">
                {"\u{1F525}"}
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-sm font-medium">Sunday Roasters</span>
                <span className="truncate text-xs text-muted-foreground">
                  Nobody else yet, send them the code
                </span>
              </span>
            </span>
          </div>
        </Panel>
      </Case>

      <Case name="played-weeks">
        <Panel title="Every week you have played">
          <PlayedWeeks weeks={fixture.playedWeeks} />
        </Panel>
      </Case>

      {/*
        Eight cells two across a phone, each with a ticker, a percentage and a
        price. The widest thing on it is a three figure move, which is the one
        that decides whether the cell holds.
      */}
      <Case name="movers">
        <Movers movers={fixture.movers} />
      </Case>

      {/*
        Home's badge row in the widest state it has: the price age only shows
        when a refresh has failed, so the three-badge row is the rare one and
        is the only one worth measuring. 320px is where it has to wrap rather
        than clip.
      */}
      <Case name="home-badges">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{priceAgeLabel(59 * 60_000)}</Badge>
          <Badge variant="outline">Market open</Badge>
          <Badge variant="outline">Play money</Badge>
        </div>
      </Case>

      <Case name="invite-code">
        <InviteCode code="ABCD2345" leagueName={fixture.LONG_LEAGUE} />
      </Case>

      <Case name="league-forms">
        <Panel title="Leagues">
          <div className="flex flex-col gap-6">
            <CreateLeagueForm />
            <JoinLeagueForm />
          </div>
        </Panel>
      </Case>

      <Case name="shared-cards">
        <Panel title="What you have shared">
          <SharedCards cards={fixture.sharedCards} />
        </Panel>
      </Case>

      <Case name="notification-settings">
        <Panel title="Notifications">
          <NotificationSettings
            initial={fixture.notificationSettings}
            devices={2}
            pushAvailable
            emailAvailable
            publicKey=""
          />
        </Panel>
      </Case>

      <Case name="plus-none">
        <Panel title="Plus">
          <PlusControls
            status="none"
            hasPlus={false}
            until={null}
            cadences={["monthly", "yearly"]}
            canManage={false}
          />
        </Panel>
      </Case>

      <Case name="plus-past-due">
        <Panel title="Plus, past due">
          <PlusControls
            status="past_due"
            hasPlus
            until="2026-09-30"
            cadences={["monthly", "yearly"]}
            canManage
          />
        </Panel>
      </Case>

      {/*
        Two addresses on one account, one of them long enough to need it. The
        row truncates rather than pushing the badge off a phone.
      */}
      <Case name="sign-in-addresses">
        <Panel title="Ways to sign in">
          <SignInAddresses
            primaryEmail="martin.aasa@upthink.ee"
            addresses={[
              {
                id: "a",
                email: "aasamartinaasa@gmail.com",
                verified: true,
                addedAt: "2026-08-20T10:00:00.000Z",
              },
              {
                id: "b",
                email: "martin.aasa.the.longer.one@somewhere.example.co.uk",
                verified: true,
                addedAt: "2026-08-23T10:00:00.000Z",
              },
            ]}
            googleEnabled
          />
        </Panel>
      </Case>

      <Case name="account-controls">
        <Panel title="Your account">
          <AccountControls />
        </Panel>
      </Case>

      {/*
        The screen somebody gets when a room will not draw. It has no route of
        its own to visit, so it is measured here instead — the copy is long
        enough to wrap on a phone and the digest line is a figure that must not
        be cut in half.
      */}
      <Case name="error-boundary">
        <ErrorPreview />
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
