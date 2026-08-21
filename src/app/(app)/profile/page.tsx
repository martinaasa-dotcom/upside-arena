import { Panel } from "@/components/Panel";
import { HairlineCell, HairlineGrid } from "@/components/HairlineGrid";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ProfileForm } from "@/components/ProfileForm";
import { AccountControls } from "@/components/AccountControls";
import { ConsentControl } from "@/components/ConsentControl";
import { getSession } from "@/lib/profile";
import { PAGE, STACK } from "@/lib/page-shell";
import { formatDate, initials } from "@/lib/format";
import { signOut } from "@/app/auth/actions";

export const metadata = { title: "Profile" };

export default async function ProfilePage() {
  const { user, profile } = await getSession();
  const name = profile?.display_name ?? "Player";

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
            <span className="figure text-lg font-semibold">0</span>
          </HairlineCell>
        </HairlineGrid>
      </Panel>

      <Panel title="Your details" description="Change how you appear to other players.">
        <ProfileForm
          defaultName={profile?.display_name ?? ""}
          defaultHandle={profile?.handle ?? ""}
          email={user?.email ?? ""}
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
