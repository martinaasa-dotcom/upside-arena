"use client";

import { useEffect, useRef, type ReactNode } from "react";

/*
  How far below the window a section arrives, as a fraction of the window.

  This shipped as `-12%`, a *negative* margin, which shrinks the observer's
  root rather than growing it: a section did not begin arriving until it was
  already inside the window. Measured on the real page at 390x844 and
  1440x900, every block on it flipped to "in" while sitting 116px to 185px
  *above* the fold, and only then started a half-second fade. What a reader
  saw where the next section should be was an empty band and then something
  slowly appearing, and the reasonable thing to conclude is that the page has
  ended, so back up they go and never see the rest of it.

  Grown rather than shrunk, and by more than a screen. Re-measured, every
  block that still fades starts fading around 1000px to 1100px below the
  fold, which at any real scrolling speed is a second or more of head start,
  and the two sections under the hero never fade at all because they are
  inside the lead when the page loads.

  Upside Lab's `Reveal` is this component with the same number and the same
  guard, and it had the same bug for the same reason. The two apps are one
  design; fix both or neither.
*/
const ARRIVE_LEAD = 1.25;

/*
  A section of the signed-out page fading in the first time it is scrolled to.

  Not to be confused with Reveal.tsx, which is a contest opening everybody's
  book at the end of a week. This one is about arriving on a page.

  A CSS transition driven by an attribute rather than an animation, because
  the state is set on an element that is already in the document. `.rise` in
  globals.css stays an animation: it is the hero's one shot on mount and has
  nothing to wait for.

  The attribute is written straight onto the node rather than held in React
  state, which is what it is for: nothing else on the page renders differently
  because a section has arrived, so routing it through state would be two
  renders to set one attribute. It also means the element is only ever marked
  from script. Before hydration, and in any browser with no
  IntersectionObserver, it carries no `data-reveal` at all and is plain
  visible, which is the safe direction to fail in: nothing can leave a section
  of the page permanently blank because an observer never fired.

  NOTHING ALREADY ON SCREEN IS EVER HIDDEN, AND NOR IS THE SCREEN AFTER IT.
  The rect is measured first, and a section inside the lead is marked arrived
  without passing through the hidden state at all. Without that check,
  hydrating hides whatever the reader is looking at and then fades it back in
  a frame later, which is a flash on the first screen; and anybody who arrived
  at a scroll position that is not the top, by following a link with a hash,
  by reloading part way down, or by having the browser restore where they
  were, watches the page they were reading disappear. The check used to stop
  at the fold, which left the section immediately under it fading in because
  somebody scrolled. It is now the whole lead, so the screenful after the one
  you are looking at is finished before you get there. The observer is only
  for what is further down than that.

  It disconnects on the first intersection. This is an arrival, not a scrubbed
  animation, and a section that faded out again on the way back up would be a
  toy.

  There is no per-section delay. A row of cards is what a heading is a heading
  *of*, and staggering the two meant the commonest thing at a section boundary
  was a title with a hole under it. Anything that has to be read as one thing
  goes inside one Arrive.
*/
export function Arrive({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (typeof IntersectionObserver === "undefined") return;

    // In view, scrolled past, or in the screen and a bit after it. Arrived,
    // and never hidden.
    if (
      element.getBoundingClientRect().top <
      window.innerHeight * (1 + ARRIVE_LEAD)
    ) {
      element.dataset.reveal = "in";
      return;
    }

    element.dataset.reveal = "out";

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          element.dataset.reveal = "in";
          observer.disconnect();
        }
      },
      {
        rootMargin: `0px 0px ${Math.round(ARRIVE_LEAD * 100)}% 0px`,
        threshold: 0,
      }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
