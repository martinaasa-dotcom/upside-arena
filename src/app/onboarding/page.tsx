import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSession, isOnboarded } from "@/lib/profile";
import { OnboardingForm } from "@/components/OnboardingForm";
import { ArenaWordmark } from "@/components/brand/ArenaWordmark";
import { Skeleton } from "@/components/Skeleton";
import { PAGE, PAGE_FRAME } from "@/lib/page-shell";

export const metadata = { title: "Set up your profile" };

/*
  The one setup step, prerendered down to the form.

  What this page says is the same for everybody. What it cannot know until it
  asks is what to put in the two fields -- a name Google may already have
  given us, a handle derived from it -- and whether the person is supposed to
  be here at all.

  This is the screen immediately after a sign-in link is clicked, on a device
  that has just been handed a session and has nothing else warm. Sending the
  words while the rest is read is worth more here than almost anywhere.
*/
export default function OnboardingPage() {
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

          {/*
            The form's own height, so the page does not jump when the fields
            arrive with whatever we already knew typed into them.
          */}
          <Suspense fallback={<FormPending />}>
            <NameForm />
          </Suspense>
        </div>
      </main>
    </div>
  );
}

function FormPending() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true">
      <span className="sr-only">Loading</span>
      <Skeleton className="h-11 w-full rounded-lg" />
      <Skeleton className="h-11 w-full rounded-lg" />
      <Skeleton className="h-11 w-32 rounded-lg" />
    </div>
  );
}

/*
  The gates, and what they guard.

  Both still run on every visit. What has changed is that they interrupt a
  screen of empty fields rather than a blank one, and proxy.ts has already
  refused this route to anybody without a session before it gets here, so the
  first of the two is the second lock on the same door.
*/
async function NameForm() {
  const { user, profile } = await getSession();

  if (!user) redirect("/");
  if (isOnboarded(profile)) redirect("/home");

  const suggestedName = profile?.display_name ?? "";
  const suggestedHandle = (profile?.handle ?? suggestedName)
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 20);

  return (
    <OnboardingForm
      defaultName={suggestedName}
      defaultHandle={suggestedHandle.length >= 3 ? suggestedHandle : ""}
    />
  );
}
