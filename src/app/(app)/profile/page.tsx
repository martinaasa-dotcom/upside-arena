import { Suspense } from "react";
import Link from "next/link";
import { Coins } from "lucide-react";
import { Panel } from "@/components/Panel";
import { HairlineCell, HairlineGrid } from "@/components/HairlineGrid";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ProfileForm } from "@/components/ProfileForm";
import { SignInAddresses } from "@/components/SignInAddresses";
import { AccountControls } from "@/components/AccountControls";
import { ConsentControl } from "@/components/ConsentControl";
import { ReplayTour } from "@/components/ReplayTour";
import { Wardrobe } from "@/components/Wardrobe";
import { flairRing } from "@/components/Flair";
import { NotificationSettings } from "@/components/NotificationSettings";
import { SharedCards } from "@/components/SharedCards";
import { getSession } from "@/lib/profile";
import { getRewards } from "@/lib/game/streaks";
import { getLeagues } from "@/lib/game/leagues";
import { getSeasonHistory } from "@/lib/game/seasons";
import { getPlayedWeeks } from "@/lib/game/record";
import { PlayedWeeks } from "@/components/LeagueRecord";
import { getMyCards } from "@/lib/game/share";
import { getStanding, FREE_STANDING } from "@/lib/billing/entitlements";
import { flairStyleKey } from "@/lib/game/cosmetics";
import { getNotificationState, DEFAULT_SETTINGS } from "@/lib/notify/settings";
import { listAddresses } from "@/lib/auth/linked-emails";
import { ADDRESS_MESSAGES, type AddressOutcome } from "@/lib/auth/address-link";
import { googleConfigured } from "@/lib/auth/google";
import { PAGE, STACK } from "@/lib/page-shell";
import { formatDate, initials, ordinal, plural } from "@/lib/format";
import { signOut } from "@/app/auth/actions";
import { SettingBar } from "@/components/ui/setting-row";

/*
  One season row, whether it is a settled quarter or the one you are in.
  Both are links to the same table, so both are the same row.
*/
const SEASON_ROW =
  "glass-well flex h-14 items-center gap-3 rounded-lg px-4 transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

export const metadata = { title: "Profile" };

/*
  The heading is the room; everything about the person streams under it.
*/
export default function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ address?: string }>;
}) {
  return (
    <div className={`${PAGE} ${STACK}`}>
      <h1>Profile</h1>
      <Suspense fallback={null}>
        <Player searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Player({
  searchParams,
}: {
  searchParams: Promise<{ address?: string }>;
}) {
  const { user, profile } = await getSession();
  const name = profile?.display_name ?? "Player";

  /*
    All at once, because none of these six wants anything the others produce.
    Awaited one after another they queued behind each other for no reason, and
    the profile screen took as long as all of them added together.
  */
  const [rewards, leagues, seasons, cards, standing, notifications, weeks, addresses] = user
    ? await Promise.all([
        getRewards(user.id),
        getLeagues(user.id),
        getSeasonHistory(user.id),
        getMyCards(user.id),
        getStanding(user.id),
        getNotificationState(user.id),
        getPlayedWeeks(user.id),
        listAddresses(user.id),
      ])
    : [
        {
          owned: [],
          locked: [],
          forSale: [],
          equipped: { title: null, flair: null, theme: null },
        },
        [],
        [],
        [],
        FREE_STANDING,
        {
          settings: DEFAULT_SETTINGS,
          devices: 0,
          pushAvailable: false,
          emailAvailable: false,
        },
        [],
        [],
      ];

  const wearing = rewards.owned.find(
    (item) => item.kind === "title" && item.equipped
  );
  const ring = flairRing(await flairStyleKey(profile?.equipped_flair ?? null));

  return (
    <>
      <Panel>
        <div className="flex items-center gap-4">
          <Avatar className={`size-14 rounded-xl ${ring}`}>
            {profile?.avatar_url ? <AvatarImage src={profile.avatar_url} alt="" /> : null}
            <AvatarFallback className="rounded-xl text-base">
              {initials(name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold tracking-tight">{name}</p>
            {profile?.handle ? (
              <p className="figure truncate text-sm text-muted-foreground">
                @{profile.handle}
              </p>
            ) : null}
            {wearing ? (
              <p className="mt-1 text-sm text-primary">{wearing.name}</p>
            ) : null}
            <p className="mt-1 text-sm text-muted-foreground">
              Playing since {profile ? formatDate(profile.created_at) : "today"}
            </p>
          </div>
        </div>
      </Panel>

      <Panel
        title="Your record"
        description="Lifetime totals. These never mix into the current week."
      >
        <HairlineGrid maxColumns={4}>
          <HairlineCell>
            <span className="text-sm text-muted-foreground">Weeks played</span>
            <span className="figure text-lg font-semibold">
              {profile?.weeks_played ?? 0}
            </span>
          </HairlineCell>
          <HairlineCell>
            <span className="text-sm text-muted-foreground">Best week</span>
            {profile?.best_week_return != null ? (
              <span className="figure text-lg font-semibold">
                {Number(profile.best_week_return).toFixed(1)}%
              </span>
            ) : (
              <span className="text-lg font-semibold text-muted-foreground">Not yet</span>
            )}
          </HairlineCell>
          <HairlineCell>
            <span className="text-sm text-muted-foreground">Longest streak</span>
            <span className="figure text-lg font-semibold">
              {profile?.longest_streak ?? 0}
            </span>
          </HairlineCell>
          <HairlineCell>
            <span className="text-sm text-muted-foreground">Leagues</span>
            <span className="figure text-lg font-semibold">{leagues.length}</span>
          </HairlineCell>
        </HairlineGrid>
      </Panel>

      {/*
        Every week, before the seasons that add them up.

        This screen had lifetime totals and no weeks -- how many played, the
        best one, the average against the market. All true, and all of it the
        kind of number that describes somebody rather than reminding them of
        anything. What a person recognises is the week itself: the one they
        were up nine per cent, the three in a row they were behind. The totals
        above are what these come to.
      */}
      {weeks.length > 0 ? (
        <Panel
          title="Every week you have played"
          description="Newest first, and settled on the Friday it happened. An aqua edge is a week you finished ahead of the market, which is the one that counts."
        >
          <PlayedWeeks weeks={weeks} />
        </Panel>
      ) : null}

      {/*
        This panel is always drawn, and that is not a style choice.

        Season used to be a tab on the dock. It is not any more, because a
        room whose every figure was settled on a Friday is a record rather
        than a room, and this page is where the rest of a player's record
        lives. That makes this the only way into the season table, so a
        version of this panel that renders nothing until somebody has a
        settled season is a room with no door: a new player could not reach
        it at all, which is worse than the tab it replaced.

        With nothing settled yet the row is still a row, still a link, and
        still true. It says the quarter is running and that no weeks of it
        have been counted, which is exactly what a person in their first
        week wants to know.
      */}
      <Panel
        title="Your seasons"
        description="A quarter of weeks at a time. A finished season keeps the place you finished in; a running one has none yet."
      >
        <div className="flex flex-col gap-2">
          {seasons.length > 0 ? (
            seasons.map(({ season, rank, weeksPlayed }) => (
              <Link key={season.id} href="/season" className={SEASON_ROW}>
                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                  {season.name}
                </span>
                <span className="figure shrink-0 text-sm text-muted-foreground">
                  {plural(weeksPlayed, "week")}
                </span>
                <span className="figure w-20 shrink-0 text-right text-sm font-semibold">
                  {rank != null
                    ? ordinal(rank)
                    : season.status === "closed"
                      ? "Unranked"
                      : "Running"}
                </span>
              </Link>
            ))
          ) : (
            <Link href="/season" className={SEASON_ROW}>
              <span className="min-w-0 flex-1 truncate text-sm font-medium">
                This quarter
              </span>
              <span className="figure shrink-0 text-sm text-muted-foreground">
                {plural(0, "week")}
              </span>
              <span className="figure w-20 shrink-0 text-right text-sm font-semibold">
                Running
              </span>
            </Link>
          )}
        </div>
      </Panel>

      <Panel
        title="How you look"
        description="Decoration only. None of it changes a score, and the bought ones say so."
      >
        <Wardrobe wardrobe={rewards} />
      </Panel>

      <Panel title="Your details" description="Change how you appear to other players.">
        <ProfileForm
          defaultName={profile?.display_name ?? ""}
          defaultHandle={profile?.handle ?? ""}
          email={user?.email ?? ""}
        />
      </Panel>

      {/*
        One account, however many mailboxes the person has. A second address
        that made a second account would be a second player tag and a record
        starting from nothing, which is why this is here rather than in a
        support inbox.
      */}
      <Panel
        title="Ways to sign in"
        description="Every address here opens this account, with this player tag and this record. Nothing new is made."
      >
        <SignInAddresses
          primaryEmail={user?.email ?? ""}
          addresses={addresses}
          googleEnabled={googleConfigured()}
          notice={await addressNotice(searchParams)}
        />
      </Panel>

      {notifications.pushAvailable || notifications.emailAvailable ? (
        <Panel
          title="Being told things"
          description="Every one of these is something that actually happened. Turn off any of them and it stops immediately."
        >
          <NotificationSettings
            initial={notifications.settings}
            devices={notifications.devices}
            pushAvailable={notifications.pushAvailable}
            emailAvailable={notifications.emailAvailable}
            publicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ""}
          />
        </Panel>
      ) : null}

      <Panel
        title={standing.hasPlus ? "Arena Plus" : "Decoration, if you want it"}
        description={
          standing.hasPlus
            ? "Thank you. Manage or cancel any time, in one tap."
            : "The whole game is free. There is a subscription and a shop for titles, and neither changes a score."
        }
        action={
          <span className="flex items-center gap-2">
            <span className="figure flex items-center gap-1.5 text-sm text-muted-foreground">
              <Coins className="size-3.5 text-primary" aria-hidden="true" />
              {standing.coins}
            </span>
            <Button asChild variant={standing.hasPlus ? "outline" : "default"} size="sm">
              <Link href="/plus">{standing.hasPlus ? "Manage" : "See it"}</Link>
            </Button>
          </span>
        }
      />

      <Panel
        title="Weeks you have shared"
        description="Anyone holding one of these links can see that week, and nothing else about you."
      >
        <SharedCards
          cards={cards.map((card) => ({
            id: card.id,
            url: card.url,
            monday: card.recap.monday,
            returnPercent: card.recap.returnPercent,
          }))}
        />
      </Panel>

      {/*
        The rules, somewhere a signed-in player can find them again.

        The first-week list on Home links here too, and that list goes once it
        is done. Somewhere permanent matters: the question "wait, how is this
        actually scored" turns up in week six, not week one.
      */}
      <Panel
        title="How Arena works"
        description="What the money is, how a week is scored, what a battle is, and what none of this is. Two minutes."
        action={
          <Button asChild variant="outline" size="sm">
            <Link href="/how">Read</Link>
          </Button>
        }
      >
        <SettingBar action={<ReplayTour />}>
          <span className="block truncate text-sm font-medium">
            Show me around again
          </span>
        </SettingBar>
      </Panel>

      <Panel
        title="Measuring how the app is used"
        description="Optional, and off until you say yes. Arena works the same either way."
      >
        <ConsentControl />
      </Panel>

      <Panel
        title="Your data"
        description="Download everything we hold about you, or close your account for good."
      >
        <AccountControls />
      </Panel>

      <Panel
        title="Sign out"
        action={
          <form action={signOut}>
            <Button type="submit" variant="outline" size="sm">
              Sign out
            </Button>
          </form>
        }
      />
    </>
  );
}

/**
 * What to say about an address the Google handshake just came back from.
 *
 * The sentences live with the rules that produce them, so the redirect carries
 * a word and the screen looks up what it means. A word this screen does not
 * know says nothing at all rather than guessing.
 */
async function addressNotice(
  searchParams: Promise<{ address?: string }>
): Promise<string | undefined> {
  const { address } = await searchParams;
  if (!address) return undefined;

  return ADDRESS_MESSAGES[address as AddressOutcome];
}
