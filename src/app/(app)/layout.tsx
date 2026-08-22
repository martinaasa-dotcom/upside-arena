import { redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { BottomDock } from "@/components/BottomDock";
import { InstallPrompt } from "@/components/InstallPrompt";
import { Toaster } from "@/components/ui/sonner";
import { getSession, isOnboarded } from "@/lib/profile";
import { themeStyleKey } from "@/lib/game/cosmetics";
import { PAGE_FRAME } from "@/lib/page-shell";

/*
  Allowed to block, for now.

  This layout establishes who is asking before it renders anything, and two
  redirects hang off the answer: a signed-out visitor goes to the sign-in
  page, and somebody who has not finished onboarding goes to finish it. Both
  have to happen before a room is shown, not streamed in after it.

  Giving these rooms a static shell means moving the session read below the
  chrome and letting the gates run inside a boundary, which changes when a
  redirect fires and what has already been painted when it does. That is its
  own piece of work with its own testing, and it is not folded into the pass
  that turned Cache Components on. The public routes, which are where a cold
  visitor actually lands, are converted.
*/
export const instant = false;

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { user, profile } = await getSession();

  if (!user) redirect("/");
  if (!isOnboarded(profile)) redirect("/onboarding");

  /*
    How this player has chosen to light their own screens. Only they see it:
    a theme changes the ambient glow and nothing that anybody else looks at.
  */
  const theme = await themeStyleKey(profile?.equipped_theme ?? null);

  return (
    <div className={PAGE_FRAME} data-arena-theme={theme ?? undefined}>
      <AppHeader profile={profile} />

      {/* Bottom padding clears the dock. */}
      <main id="main" className="pt-8 pb-32">
        {children}
      </main>

      <BottomDock />
      <InstallPrompt weeksPlayed={profile?.weeks_played ?? 0} />

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
