"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ArenaWordmark } from "@/components/brand/ArenaWordmark";
import { Panel } from "@/components/Panel";
import { Button } from "@/components/ui/button";
import { PAGE, PAGE_FRAME } from "@/lib/page-shell";
import { reportError } from "@/lib/report-error";

/*
  When a screen cannot be drawn.

  There was no boundary here at all, so anything thrown while rendering fell
  through to Next's built-in page: white, in an app with no light theme, and
  offering nothing but the word "error". This matters more since the rooms
  started streaming their contents — a shell arrives, and whatever fails
  afterwards has to land somewhere a person can read.

  Two things it deliberately does not do. It does not guess at a cause, since
  the boundary cannot tell a dropped connection from a bug and inventing a
  reason is the same sin as inventing a figure. And it does not show the
  error, which is text written for whoever wrote the code; the digest is
  there for that, quietly, because it is what makes a report answerable.
*/
export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // The server logs its own. This is the half that only the browser sees,
    // which is why it is also sent somewhere it can be counted: a console
    // line is read by one person, with the console open, on the one machine
    // it happened on.
    console.error("screen failed to render", error);
    reportError(error);
  }, [error]);

  return (
    <div className={PAGE_FRAME}>
      <main id="main" className={`${PAGE} flex min-h-dvh flex-col justify-center py-16`}>
        <div className="mx-auto w-full max-w-md">
          <ArenaWordmark className="mb-8" />
          <Panel
            title="This screen would not load"
            description="Your week is unaffected: nothing here is stored in the page, and no result changes because a screen failed to draw."
          >
            <div className="flex flex-wrap gap-3">
              <Button onClick={reset}>Try again</Button>
              <Button asChild variant="outline">
                <Link href="/home">Go to my week</Link>
              </Button>
            </div>

            {error.digest ? (
              <p className="mt-4 text-xs text-muted-foreground">
                If it keeps happening, quoting{" "}
                <span className="figure">{error.digest}</span> tells us which
                failure was yours.
              </p>
            ) : null}
          </Panel>
        </div>
      </main>
    </div>
  );
}
