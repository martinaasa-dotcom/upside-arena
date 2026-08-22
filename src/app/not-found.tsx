import Link from "next/link";
import { ArenaWordmark } from "@/components/brand/ArenaWordmark";
import { Panel } from "@/components/Panel";
import { Button } from "@/components/ui/button";
import { PAGE, PAGE_FRAME } from "@/lib/page-shell";

/*
  A page that is not there.

  Next ships a default for this, and the default is a white page reading "404
  This page could not be found", with no way off it. Arena has no light theme,
  so that arrives as a flash of white and reads as the site being broken
  rather than the address being wrong.

  Not the page a dead share link lands on, which is worth saying because it is
  the obvious guess. /w/[token] is public and answers a token it cannot find
  itself, with a panel saying the card is no longer shared and the invitation
  still under it — a 404 there would throw away the only reason that page is
  reachable signed out. This is the plainer case: an address with nothing
  behind it, reached by somebody signed in who followed a stale link, or by
  anyone under a public prefix like /auth/. Everything else the proxy sends to
  sign-in before it can get here.
*/
export const metadata = {
  title: "Not found",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <div className={PAGE_FRAME}>
      <main id="main" className={`${PAGE} flex min-h-dvh flex-col justify-center py-16`}>
        <div className="mx-auto w-full max-w-md">
          <ArenaWordmark className="mb-8" />
          <Panel
            title="There is nothing at this address"
            description="The link may have been mistyped, or it may have pointed at something that has since moved. Nothing is wrong on your end."
          >
            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <Link href="/">Play a week</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/home">Go to my week</Link>
              </Button>
            </div>
          </Panel>
        </div>
      </main>
    </div>
  );
}
