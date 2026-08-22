import { redirect } from "next/navigation";
import { getSession, isOnboarded } from "@/lib/profile";
import { OnboardingForm } from "@/components/OnboardingForm";
import { ArenaWordmark } from "@/components/brand/ArenaWordmark";
import { PAGE, PAGE_FRAME } from "@/lib/page-shell";

export const metadata = { title: "Set up your profile" };

/*
  Allowed to block, for the same reason the app layout is: this page decides
  whether somebody should be here at all, and sends them away if not. A gate
  that streams in after the page has painted is not a gate.
*/
export const instant = false;

export default async function OnboardingPage() {
  const { user, profile } = await getSession();

  if (!user) redirect("/");
  if (isOnboarded(profile)) redirect("/home");

  const suggestedName = profile?.display_name ?? "";
  const suggestedHandle = (profile?.handle ?? suggestedName)
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 20);

  return (
    <div className={PAGE_FRAME}>
      <main id="main" className={`${PAGE} flex min-h-dvh flex-col justify-center py-16`}>
        <div className="mx-auto w-full max-w-md">
          <ArenaWordmark className="mb-8" />
          <h1 className="mb-2">What should we call you?</h1>
          <p className="mb-6 text-sm text-muted-foreground">
            This is the only setup step. Your friends will see this name on the
            league board.
          </p>
          <OnboardingForm
            defaultName={suggestedName}
            defaultHandle={suggestedHandle.length >= 3 ? suggestedHandle : ""}
          />
        </div>
      </main>
    </div>
  );
}
