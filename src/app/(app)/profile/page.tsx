import { Panel } from "@/components/Panel";
import { HairlineCell, HairlineGrid } from "@/components/HairlineGrid";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ProfileForm } from "@/components/ProfileForm";
import { AccountControls } from "@/components/AccountControls";
import { ConsentControl } from "@/components/ConsentControl";
import { Titles } from "@/components/Titles";
import { NotificationSettings } from "@/components/NotificationSettings";
import { SharedCards } from "@/components/SharedCards";
import { getSession } from "@/lib/profile";
import { getRewards } from "@/lib/game/streaks";
import { getLeagues } from "@/lib/game/leagues";
import { getMyCards } from "@/lib/game/share";
import { getNotificationState, DEFAULT_SETTINGS } from "@/lib/notify/settings";
import { PAGE, STACK } from "@/lib/page-shell";
import { formatDate, initials } from "@/lib/format";
import { signOut } from "@/app/auth/actions";

export const metadata = { title: "Profile" };

export default async function ProfilePage() {
  const { user, profile } = await getSession();
  const name = profile?.display_name ?? "Player";
  const rewards = user
    ? await getRewards(user.id)
    : { owned: [], locked: [], equipped: null };

  const leagues = user ? await getLeagues(user.id) : [];
  const cards = user ? await getMyCards(user.id) : [];

  const notifications = user
    ? await getNotificationState(user.id)
    : {
        settings: DEFAULT_SETTINGS,
        devices: 0,
        pushAvailable: false,
        emailAvailable: false,
      };

  const wearing = rewards.owned.find((title) => title.equipped);

  return (
    <div className={`${PAGE} ${STACK}`}>
      <h1>Profile</h1>

      <Panel>
        <div className="flex items-center gap-4">
          <Avatar className="size-14 rounded-xl">
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

      <Panel
        title="Titles"
        description="Decoration only. A title never changes your score, and none of them can be bought."
      >
        <Titles
          owned={rewards.owned}
          locked={rewards.locked}
          equipped={rewards.equipped}
        />
      </Panel>

      <Panel title="Your details" description="Change how you appear to other players.">
        <ProfileForm
          defaultName={profile?.display_name ?? ""}
          defaultHandle={profile?.handle ?? ""}
          email={user?.email ?? ""}
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

      <Panel title="Sign out">
        <form action={signOut}>
          <Button type="submit" variant="outline">
            Sign out
          </Button>
        </form>
      </Panel>
    </div>
  );
}
