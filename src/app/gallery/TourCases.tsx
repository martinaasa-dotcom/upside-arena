"use client";

import { Case } from "./Case";
import { TourScreen } from "@/components/WelcomeTour";
import { STEPS } from "@/lib/tour-steps";
import { BOX } from "@/lib/page-shell";

/*
  Every screen of the walkthrough, in the page flow.

  A modal is the easiest thing in an app to ship broken on a phone -- nobody
  looks at it twice, and the one time it is wrong is the first minute of
  somebody's first visit. Rendered here, all eight are in front of the
  clipping probe at every width, and the two that matter are the ones with
  five things on them: the rooms and the record.

  A thin client wrapper for the same reason ErrorPreview is one: a step
  carries a lucide icon, which is a function, and a function cannot be handed
  from a server component to a client one. Importing the steps on this side of
  the boundary means nothing has to cross it.

  The dialog shell is not here, only what goes in it. What the shell does
  about a short screen -- a height, an internal scroller -- is its own
  business and cannot be measured inside a page that scrolls anyway.
*/
export function TourCases() {
  return (
    <>
      {STEPS.map((step, i) => (
        <Case key={step.key} name={`tour-${step.key.toLowerCase()}`}>
          <div className={`${BOX} flex flex-col`}>
            <TourScreen step={step} index={i} total={STEPS.length} />
          </div>
        </Case>
      ))}
    </>
  );
}
