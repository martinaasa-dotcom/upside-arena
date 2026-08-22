import { redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { BottomDock } from "@/components/BottomDock";
import { InstallPrompt } from "@/components/InstallPrompt";
import { Toaster } from "@/components/ui/sonner";
import { getSession, isOnboarded } from "@/lib/profile";
import { themeStyleKey } from "@/lib/game/cosmetics";
import { PAGE_FRAME } from "@/lib/page-shell";

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
