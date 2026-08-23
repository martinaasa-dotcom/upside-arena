"use client";

import { useEffect, useRef, type ReactNode } from "react";

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

  The observer disconnects on the first intersection. This is an arrival, not
  a scrubbed animation, and a section that faded out again on the way back up
  would be a toy.
*/
export function Arrive({
  children,
  className,
  delayMs = 0,
}: {
  children: ReactNode;
  className?: string;
  delayMs?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (typeof IntersectionObserver === "undefined") return;

    element.dataset.reveal = "out";

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          element.dataset.reveal = "in";
          observer.disconnect();
        }
      },
      /*
        Fires a little before the section reaches the bottom edge, so it has
        finished arriving by the time it is actually being read.
      */
      { rootMargin: "0px 0px -12% 0px", threshold: 0.05 }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={delayMs ? { transitionDelay: `${delayMs}ms` } : undefined}
      className={className}
    >
      {children}
    </div>
  );
}
