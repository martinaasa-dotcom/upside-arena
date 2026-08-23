import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarDays, Users, Wallet } from "lucide-react";
import { getSession, isOnboarded } from "@/lib/profile";
import { STARTING_BALANCE } from "@/lib/game";
import { formatMoney } from "@/lib/format";
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
            Three lines about what they have just signed up for, above the
            fields rather than behind a tour.

            This screen used to ask for a name and a tag and say nothing at all
            about the game, so the first thing anybody learned about Arena was
            that it wanted two things from them. It is still one step and still
            one button: the words are what changed, not the number of screens,
            because every step between signing up and the first live number is
            somewhere to lose somebody.
          */}
          <div className="mb-6 flex flex-col gap-2">
            {[
              {
                icon: Wallet,
                text: `You get ${formatMoney(STARTING_BALANCE)} of pretend money. It is not real, nothing here becomes real, and you cannot lose money you had.`,
              },
              {
                icon: CalendarDays,
                text: "Buy shares in real companies at real prices. On Friday the week is scored on how you did against the market, and on Monday everybody starts level again.",
              },
              {
                icon: Users,
                text: "We will make you a league of your own. Send the code to one person and you have a race.",
              },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="glass-well flex items-start gap-3 rounded-lg p-4">
                <Icon
                  className="mt-0.5 size-4 shrink-0 text-primary"
                  aria-hidden="true"
                />
                <p className="text-sm text-muted-foreground">{text}</p>
              </div>
            ))}
          </div>

          {/*
            The form's own height, so the page does not jump when the fields
            arrive with whatever we already knew typed into them.
          */}
          <Suspense fallback={<FormPending />}>
            <NameForm />
          </Suspense>

          {/*
            What happens after the button, said before it is pressed.

            The walkthrough opens on the other side of this form, and a person
            who does not know that reads the next screen as a thing that got in
            the way. Told first, it is the rest of the sign-up.
          */}
          <p className="mt-6 text-sm text-muted-foreground">
            Next we show you around — the week, the scoring, and where
            everything is. It takes a minute and you can skip it. The long
            version lives at{" "}
            <Link href="/how" className="text-foreground underline underline-offset-4">
              how Arena works
            </Link>
            , and it is on your profile whenever you want it.
          </p>
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
