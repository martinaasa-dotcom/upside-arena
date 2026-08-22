import { Suspense } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/Panel";
import { ArenaWordmark } from "@/components/brand/ArenaWordmark";
import { PAGE, PAGE_FRAME } from "@/lib/page-shell";

/*
  Every reason the app can redirect here with, and what it says about it.

  A reason with nothing written for it falls back to "something went wrong",
  which is the least useful thing a screen can say to somebody who cannot get
  in. There is a test that keeps this list level with the reasons the code
  actually emits.
*/
const REASONS: Record<string, string> = {
  expired: "That sign-in link has already been used, or it timed out. Links last one hour.",
  "missing-token": "That link is missing part of its address. Ask for a fresh one.",
  "missing-code": "Google sent us back without a sign-in code. Try once more.",
  exchange: "We could not finish signing you in with Google. Try once more.",
  state:
    "That sign-in took too long, or it was not started on this device. Start again from the beginning.",
  identity:
    "Google confirmed who you are, but we could not finish signing you in. Try once more.",
  "not-configured": "Sign-in is not connected yet.",
};

export const KNOWN_REASONS = Object.keys(REASONS);

export default function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  /*
    The frame is the same whatever went wrong, so it is prerendered and only
    the sentence explaining which thing went wrong waits for the URL. Somebody
    who could not sign in has already had one thing fail on them; the page
    telling them so should not also arrive late.
  */
  return (
    <div className={PAGE_FRAME}>
      <main id="main" className={`${PAGE} flex min-h-dvh flex-col justify-center py-16`}>
        <div className="mx-auto w-full max-w-md">
          <ArenaWordmark className="mb-8" />
          <Suspense fallback={<Panel title="We could not sign you in" />}>
            <Reason searchParams={searchParams} />
          </Suspense>
        </div>
      </main>
    </div>
  );
}

async function Reason({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;
  const message = REASONS[reason ?? ""] ?? "Something went wrong signing you in.";

  return (
    <Panel title="We could not sign you in" description={message}>
      <Button asChild className="mt-2">
        <Link href="/">Back to sign in</Link>
      </Button>
    </Panel>
  );
}
