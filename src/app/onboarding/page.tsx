import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarDays, Users, Wallet } from "lucide-react";
import { getSession, isOnboarded } from "@/lib/profile";
import { STARTING_BALANCE } from "@/lib/game";
import { formatMoney } from "@/lib/format";
import { OnboardingForm } from "@/components/OnboardingForm";
import { BrandBar } from "@/components/BrandBar";
import { Panel, Well } from "@/components/Panel";
import { Skeleton } from "@/components/Skeleton";
import { PAGE, PAGE_FRAME, STACK } from "@/lib/page-shell";

export const metadata = { title: "Set up your profile" };

const SETUP_POINTS = [
  {
    icon: Wallet,
    term: "Pretend money",
    text: `You get ${formatMoney(STARTING_BALANCE)}. It is not real, nothing here becomes real, and you cannot lose money you had.`,
  },
  {
    icon: CalendarDays,
    term: "One week at a time",
    text: "Buy shares in real companies at real prices. On Friday the week is scored against the market, and on Monday everybody starts level again.",
  },
  {
    icon: Users,
    term: "A league of your own",
    text: "We will make you one. Send the code to one person and you have a race.",
  },
] as const;

/*
  The one setup step, prerendered down to the form.

  What this page says is the same for everybody. What it cannot know until it
  asks is what to put in the two fields -- a name Google may already have
  given us, a handle derived from it -- and whether the person is supposed to
  be here at all.

  This is the screen immediately after a sign-in link is clicked, on a device
  that has just been handed a session and has nothing else warm. Sending the
  words while the rest is read is worth more here than almost anywhere.

  The lockup lives in BrandBar, the same bar the rooms use, not in the column.
  This page used to vertically centre a stack that is taller than a phone,
  which put the mark above the scrollport. The bar has no home link: finishing
  this step is the only way into the rooms, and a tap on the mark that sent
  them to Home would bounce them straight back here.
*/
export default function OnboardingPage() {
  return (
    <div className={PAGE_FRAME}>
      <BrandBar room="Set up" />

      <main id="main" className={`${PAGE} py-8`}>
        <div className={`mx-auto w-full max-w-md ${STACK}`}>
          <div>
            <h1>What should we call you?</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              This is the only setup step. Your friends will see this name on
              the league board.
            </p>
          </div>

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
          <Panel>
            <ul className="flex flex-col gap-2">
              {SETUP_POINTS.map(({ icon: Icon, term, text }) => (
                <li key={term}>
                  <Well className="flex items-start gap-3">
                    <Icon
                      className="mt-0.5 size-4 shrink-0 text-primary"
                      aria-hidden="true"
                    />
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="text-sm font-medium">{term}</span>
                      <span className="text-sm text-muted-foreground">{text}</span>
                    </span>
                  </Well>
                </li>
              ))}
            </ul>
          </Panel>

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
          <p className="text-sm text-muted-foreground">
            Next we show you around: the week, the scoring, and where
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
    <Panel aria-busy="true">
      <span className="sr-only">Loading</span>
      <div className="flex flex-col gap-5">
        <FieldPending />
        <FieldPending />
        <Skeleton className="h-11 w-full rounded-lg" />
        <Skeleton className="h-4 w-3/4 rounded-lg" />
      </div>
    </Panel>
  );
}

function FieldPending() {
  return (
    <div className="flex flex-col gap-1.5">
      <Skeleton className="h-4 w-24 rounded-lg" />
      <Skeleton className="h-11 w-full rounded-lg" />
      <Skeleton className="h-4 w-2/3 rounded-lg" />
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
