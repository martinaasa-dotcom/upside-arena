import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/Panel";
import { ArenaWordmark } from "@/components/brand/ArenaWordmark";
import { PAGE, PAGE_FRAME } from "@/lib/page-shell";

const REASONS: Record<string, string> = {
  expired: "That sign-in link has already been used, or it timed out. Links last one hour.",
  "missing-token": "That link is missing part of its address. Ask for a fresh one.",
  "missing-code": "Google sent us back without a sign-in code. Try once more.",
  exchange: "We could not finish signing you in. Try once more.",
  oauth: "Google sign-in is unavailable right now.",
  "not-configured": "Sign-in is not connected yet.",
};

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;
  const message = REASONS[reason ?? ""] ?? "Something went wrong signing you in.";

  return (
    <div className={PAGE_FRAME}>
      <main id="main" className={`${PAGE} flex min-h-dvh flex-col justify-center py-16`}>
        <div className="mx-auto w-full max-w-md">
          <ArenaWordmark className="mb-8" />
          <Panel title="We could not sign you in" description={message}>
            <Button asChild className="mt-2">
              <Link href="/">Back to sign in</Link>
            </Button>
          </Panel>
        </div>
      </main>
    </div>
  );
}
