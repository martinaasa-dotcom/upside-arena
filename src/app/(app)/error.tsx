"use client";

import { useEffect } from "react";
import { Panel } from "@/components/Panel";
import { Button } from "@/components/ui/button";
import { PAGE, STACK } from "@/lib/page-shell";

/*
  One room failing, contained to that room.

  Without this a thrown error anywhere below the dock replaced the whole app
  with the framework's blank error screen: no header, no dock, no way back
  except the browser's own. Here the chrome stays put and the room says what
  happened, which also means a failed price fetch on Home cannot strand
  somebody who was on their way to Leagues.

  Retrying is a real retry. reset() re-renders the segment on the server, so a
  fetch that failed because a provider blinked is simply asked again.
*/
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // The digest is what ties this to the server log line for the same throw.
    console.error("room failed", error.digest ?? error.message);
  }, [error]);

  return (
    <div className={`${PAGE} ${STACK}`}>
      <Panel
        title="That did not load"
        description="Something went wrong on our side. Nothing you did caused it, and nothing in your game has changed."
        action={
          <Button size="sm" onClick={reset}>
            Try again
          </Button>
        }
      />
    </div>
  );
}
