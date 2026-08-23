"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";
import {
  getConsent,
  getServerConsent,
  subscribeToConsent,
} from "@/lib/consent";

/*
  Says, at the fold, that the page continues.

  A page whose content is visibly cut in half by the bottom of the window is
  the strongest continuation cue there is, and it is the one this landing
  page was relying on. It only exists while the content is taller than the
  window. On a large display the signed-out page is centred inside one
  screen with nothing severed, and on a phone the thing below the fold is a
  sample league card that the reader has been given no reason to believe is
  there. Either way the page reads as finished when it is not.

  So this is the backstop, and where it sits is the whole point: pinned to
  the bottom of the *window*, in view exactly while the reader is deciding
  whether there is anything more, and gone the moment they act on it. An
  arrow laid out under the last card instead would be below the fold, which
  is to say off screen at the one moment the hint is needed.

  It is a button rather than an arrow drawn on the page, because a hint that
  does the thing it hints at costs nothing extra. Clicking moves one
  screenful, or jumps outright when the reader has asked for less motion.

  Same component, same words and same shape as Upside Lab's. The two apps
  are meant to stay one design.
*/

/*
  How much has to be below the fold before this is worth drawing.

  A quarter of a small laptop screen. Under that there is nothing down there
  but the tail of the last thing, and pointing at it is a promise the page
  does not keep. It also keeps the measurement question's own reserved space
  from being mistaken for content: an unanswered one pads the bottom of the
  frame by 8rem to 11rem, which is real scroll height with nothing in it.
*/
const RUNWAY = 240;

/** Scrolled at all, so they have found out for themselves. */
const ANSWERED = 24;

export function ScrollCue({
  label = "More below",
  className,
}: {
  label?: string;
  className?: string;
}) {
  const [show, setShow] = useState(false);
  const consent = useSyncExternalStore(
    subscribeToConsent,
    getConsent,
    getServerConsent
  );
  const asking = consent === "unset";

  useEffect(() => {
    const doc = document.scrollingElement ?? document.documentElement;
    const read = () => {
      setShow(
        doc.scrollHeight - doc.clientHeight > RUNWAY && doc.scrollTop <= ANSWERED
      );
    };

    read();
    window.addEventListener("scroll", read, { passive: true });
    window.addEventListener("resize", read);
    /*
      The page grows after mount: fonts land, the sign-in card fills in. A
      measurement taken once would be of a shorter page than the one the
      reader ends up looking at.
    */
    const ro =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(read);
    ro?.observe(document.body);

    return () => {
      window.removeEventListener("scroll", read);
      window.removeEventListener("resize", read);
      ro?.disconnect();
    };
  }, []);

  function jump() {
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollBy({
      top: Math.round(window.innerHeight * 0.86),
      behavior: still ? "auto" : "smooth",
    });
  }

  return (
    <>
      {/*
        A short fade into the field along the bottom edge, so content passes
        *under* the window rather than stopping at it, and so the pill does
        not read as a chip dropped on top of a row of figures.

        `pointer-events-none` is not optional on anything full-width and
        transparent over content, or it eats every click along the bottom of
        the page.
      */}
      <div
        aria-hidden
        className={cn(
          "pointer-events-none fixed inset-x-0 bottom-0 z-20 h-20 bg-gradient-to-t from-background via-background/80 to-transparent transition-opacity duration-300",
          show ? "opacity-100" : "opacity-0",
          asking && "max-sm:hidden"
        )}
      />
      <button
        type="button"
        onClick={jump}
        aria-hidden={!show}
        tabIndex={show ? 0 : -1}
        /*
          Height off the bottom is `.bottom-notice`, the same rule the
          measurement question takes, so on any page with a dock this clears
          it rather than guessing at a number.

          Below `sm` that question is a full-width strip on this exact line,
          and two things cannot have it. It is the louder of the two and it
          is asking something, so this stands down until it has been
          answered. From `sm` up the question is a card in the right-hand
          corner and this is centred, so they never meet.
        */
        className={cn(
          "bottom-notice card-sheen glass-notice fixed left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full py-2 pr-3 pl-4 text-sm text-muted-foreground ring-1 ring-foreground/20 transition-opacity duration-300 hover:text-foreground",
          show ? "opacity-100" : "pointer-events-none opacity-0",
          asking && "max-sm:hidden",
          className
        )}
      >
        {label}
        <ChevronDown className="scroll-cue-nudge size-4" aria-hidden />
      </button>
    </>
  );
}
