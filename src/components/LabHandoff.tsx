"use client";

import { useTransition } from "react";
import { ArrowUpRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/Panel";
import { track } from "@/lib/analytics";
import { closeHandoff } from "@/app/(app)/handoff-actions";
import { plural } from "@/lib/format";

/*
  Pointing somebody at Upside Lab.

  This is the only place in Arena that mentions a product where real money is
  at stake, so it is also the only place that has to be careful in this
  particular way. It says what actually happened, it does not promise that it
  will happen again, and it says plainly that the other thing is real money
  before anybody presses anything.

  Nothing here is urgent. There is no countdown, no offer, and no suggestion
  that waiting costs anything, because there is a real chance the honest
  answer for a particular reader is not yet.
*/
export function LabHandoff({
  token,
  weeksPlayed,
  weeksAhead,
  url,
}: {
  token: string;
  weeksPlayed: number;
  weeksAhead: number;
  url: string;
}) {
  const [busy, startTransition] = useTransition();

  function dismiss() {
    startTransition(async () => {
      track("lab_handoff_dismissed");
      await closeHandoff("dismissed");
    });
  }

  function follow() {
    track("lab_handoff_clicked");
    // Recorded without holding up the navigation. Losing one attribution is
    // better than making somebody wait for a database write.
    void closeHandoff("clicked");
  }

  return (
    <Panel
      title="You have been beating the market"
      description={`${weeksAhead} of your last ${plural(weeksPlayed, "week")}, with play money.`}
      action={
        <button
          type="button"
          onClick={dismiss}
          disabled={busy}
          aria-label="Not interested"
          className="-m-1 rounded p-1 text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          Upside Lab is our other product, from the same company. It is for
          people putting real money into the market, and it is where the tools
          behind these numbers actually live. A few good weeks here does not
          mean you will have good ones there, and nothing about Arena is
          financial advice.
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <Button asChild onClick={follow}>
            <a href={url} target="_blank" rel="noreferrer" data-token={token}>
              Have a look at Upside Lab
              <ArrowUpRight className="size-4" aria-hidden="true" />
            </a>
          </Button>
          <Button variant="ghost" disabled={busy} onClick={dismiss}>
            Not for me
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          We will not bring this up again if you say no. Your Arena account and
          your Lab account stay entirely separate.
        </p>
      </div>
    </Panel>
  );
}
