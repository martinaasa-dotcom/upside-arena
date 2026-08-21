import { redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { BottomDock } from "@/components/BottomDock";
import { InstallPrompt } from "@/components/InstallPrompt";
import { getSession, isOnboarded } from "@/lib/profile";
import { PAGE_FRAME } from "@/lib/page-shell";

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { user, profile } = await getSession();

  if (!user) redirect("/");
  if (!isOnboarded(profile)) redirect("/onboarding");

  return (
    <div className={PAGE_FRAME}>
      <AppHeader profile={profile} />

      {/* Bottom padding clears the dock. */}
      <main id="main" className="pt-8 pb-32">
        {children}
      </main>

      <BottomDock />
      <InstallPrompt weeksPlayed={profile?.weeks_played ?? 0} />
    </div>
  );
}
