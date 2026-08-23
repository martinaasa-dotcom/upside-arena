import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { ArenaTheme } from "@/components/ArenaTheme";
import { BottomDock } from "@/components/BottomDock";
import { InstallPrompt } from "@/components/InstallPrompt";
import { WelcomeTour } from "@/components/WelcomeTour";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Toaster } from "@/components/ui/sonner";
import { getSession, isOnboarded } from "@/lib/profile";
import { needsTour } from "@/lib/tour";
import { themeStyleKey } from "@/lib/game/cosmetics";
import { initials } from "@/lib/format";
import { PAGE_FRAME } from "@/lib/page-shell";

/*
  The chrome every room sits in, prerendered.

  Nothing in the frame, the header bar or the dock belongs to one player: they
  are the same markup for everybody, and they are what a room is recognisable
  as before any of its figures arrive. So they are the shell, and the two
  things that really are personal -- the avatar and the theme -- stream into
  it.

  This matters most where it is least visible. Moving between rooms was
  already instant, because the layout stays mounted and each room's
  loading.tsx paints on the tap. What was not instant was arriving: opening
  the installed app from the home screen, or following a push notification.
  Both are cold loads of a room, and both used to wait on a session read
  before a single pixel could be sent.
*/

export default function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className={PAGE_FRAME}>
      <AppHeader
        avatar={
          <Suspense fallback={<AvatarPending />}>
            <PlayerAvatar />
          </Suspense>
        }
      />

      {/* Bottom padding clears the dock. */}
      <main id="main" className="pt-8 pb-32">
        {children}
      </main>

      <BottomDock />

      <Suspense fallback={null}>
        <PlayerChrome />
      </Suspense>

      {/*
        Toasts belong to the rooms, so the toaster does too.

        Every toast in the app is raised by something behind the dock: a
        trade, a saved profile, a streak bonus, a card taken down. Mounted in
        the root layout it also shipped with the signed-out page, onboarding,
        the legal pages and a shared week -- none of which can raise one --
        and it is not a small component to send somebody who is only deciding
        whether to sign up.
      */}
      <Toaster />
    </div>
  );
}

/** The avatar's own outline, at its own size, so the bar does not reflow. */
function AvatarPending() {
  return (
    <Avatar>
      <AvatarFallback>
        <span className="sr-only">Loading your profile</span>
      </AvatarFallback>
    </Avatar>
  );
}

async function PlayerAvatar() {
  const { profile } = await getSession();
  const name = profile?.display_name ?? "Player";

  return (
    <Avatar>
      {profile?.avatar_url ? <AvatarImage src={profile.avatar_url} alt="" /> : null}
      <AvatarFallback>{initials(name)}</AvatarFallback>
    </Avatar>
  );
}

/*
  Who is asking, and what follows from the answer.

  Both gates are still here and still run on every room. What has changed is
  that they no longer stand in front of the chrome: the shell goes out, and
  this resolves behind it.

  Neither redirect is the thing keeping anybody out. proxy.ts refuses every
  room to a request without a session before it reaches this file at all, so
  the first gate is the second lock on the same door. The onboarding gate is
  this file's own, and what it now interrupts is a screen of empty
  placeholders rather than a blank one -- the same nothing, arriving sooner.

  getSession is cached for the request, so this and the avatar above are one
  read between them however they are ordered.
*/
async function PlayerChrome() {
  const { user, profile } = await getSession();

  if (!user) redirect("/");
  if (!isOnboarded(profile)) redirect("/onboarding");

  /*
    How this player has chosen to light their own screens. Only they see it:
    a theme changes the ambient glow and nothing that anybody else looks at.
  */
  const theme = await themeStyleKey(profile?.equipped_theme ?? null);

  return (
    <>
      <ArenaTheme theme={theme} />
      <InstallPrompt weeksPlayed={profile?.weeks_played ?? 0} />

      {/*
        The walkthrough, over a room that has already painted.

        It is here rather than on Home because a person can arrive anywhere:
        a push notification opens Leagues, an installed app opens whatever it
        was last on, and somebody who has never been told what a battle is
        should not have to find their way to Home to be told. It shows once
        ever, and lib/tour.ts decides what "once" currently means.
      */}
      {needsTour(profile) ? (
        <WelcomeTour playerName={profile?.display_name ?? null} />
      ) : null}
    </>
  );
}
