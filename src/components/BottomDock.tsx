"use client";

import { Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { ROOMS } from "@/lib/rooms";

/*
  The bottom dock, on a phone and on a desktop alike.

  It is a capsule that hugs its own contents, and on a phone it carries no
  words at all: four glyphs and your own face. That is a deliberate reversal
  of what shipped before, which was the full width of the screen with a label
  stacked under every glyph, and the reversal is only safe because of the one
  thing this dock does that the old one did not.

  IT SAYS THE NAME OF EVERY ROOM YOU TOUCH, AT THE MOMENT YOU TOUCH IT.

  The rule this replaces was "never hide a dock label at a breakpoint", and it
  was written after `max-[544px]:sr-only` hid all five of them on every phone
  anybody owns, leaving a row of glyphs and nothing to read. That rule was a
  ban on a symptom. What it was defending is a person's ability to find a room
  they have not been to, and a painted 11px word under a 16px glyph is a weak
  way to defend it: it is there for the thousandth visit as much as the first,
  and plenty of people never read it at all.

  So the name is spoken instead of painted, and it is spoken at the only
  moment somebody is definitely looking at the bar. On `pointerdown`, before
  the tap has even finished and long before the room answers, the pressed
  cell's name rises above the dock in the same glass and is gone inside a
  second. At rest there is not a word on screen. In use there is never a tap
  that does not name itself.

  That timing is not a flourish, it is spending a fault we already had. Every
  room here reads live data, so the answer to a tap comes from the server, and
  the gap between the touch and the room was previously covered by a fill
  behind the cell that said "heard you" and nothing else. It now says which
  room, which is the same reassurance plus the one piece of information a
  person who has never used the app is missing.

  At `md` and up the label is painted as well, and the chip is not drawn at
  all. That is not an inconsistency, it is the input device: a pointer has no
  press to speak on that a person would wait through, a desktop dock is
  already floating in a metre of empty page so the words cost nothing, and
  Upside Lab's desktop dock carries one cell per portfolio, whose names are
  somebody's own words and cannot be a glyph. The material, the radius and the
  marker are identical across the breakpoint. Only the word count differs.

  ONE MARKER, AND IT TRAVELS. There is a single neutral pill behind the cells
  rather than a fill that appears on one and disappears from another, and it
  slides. That is what makes a row of glyphs read as one place with a marker
  in it instead of as four buttons, and it is measured off the live cell
  rather than assumed, because the face cell and the glyph cells are only the
  same width by agreement and the labelled cells at `md` are not.

  The accent is not spent here at all. Which room you are in is the least
  surprising fact on the screen, and a slab of aqua the size of a cell was
  the loudest thing on the bar for the least reason. The pill is the veil
  language every well in the app already speaks.

  Concentric corners: `rounded-full` shell, `p-1`, `rounded-full` cells, which
  is the one radius pair that stays concentric at any size.
*/

/** How long the name stays up after a press. */
const SAY_MS = 900;

/** The pill's travel. Overshoots slightly and settles, the way a marker does. */
const SLIDE = "cubic-bezier(0.34,1.28,0.52,1)";

export function BottomDock({ me }: { me: ReactNode }) {
  return (
    <nav
      aria-label="Rooms"
      /*
       * `data-dock` is how anything else on the page finds out there is a
       * dock at the bottom of it. Asking the dock beats keeping a list of
       * the routes that have one: the dock renders from (app)/layout, so it
       * is on every room in the group, including Arena Plus and Numbers,
       * which have no tab, while any list is of something else and drifts
       * from this the moment the two disagree.
       */
      data-dock
      /*
       * `pointer-events-none` because this element spans the whole viewport
       * while only the capsule inside it draws anything. A fixed element
       * captures clicks across its entire box whether or not it paints, so
       * without this the empty band either side of the dock swallowed every
       * click along the bottom of the page, including the "Make your first
       * trade" button in the bottom-right corner of /home, which simply did
       * nothing. The capsule turns them back on.
       */
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
    >
      {/*
        The dock is the same on every room, so it is part of the prerendered
        shell. Which cell is marked is not: that is the URL, and one shell is
        served for all of them. So the row waits behind a boundary and the
        fallback draws the same row with nothing marked.

        On a tap between rooms this resolves in the same frame, because the
        router already holds the new pathname and the hook does not suspend.
        Only a cold arrival ever sees the unmarked row.
      */}
      <Suspense fallback={<Dock pathname={null} me={me} />}>
        <ActiveDock me={me} />
      </Suspense>
    </nav>
  );
}

function ActiveDock({ me }: { me: ReactNode }) {
  return <Dock pathname={usePathname()} me={me} />;
}

type Mark = { left: number; width: number };
type Said = { label: string; left: number };

function Dock({ pathname, me }: { pathname: string | null; me: ReactNode }) {
  const rowRef = useRef<HTMLDivElement>(null);
  const [mark, setMark] = useState<Mark | null>(null);
  const [said, setSaid] = useState<Said | null>(null);

  /*
    Placed before it is allowed to move. The pill's first position is wherever
    the room you arrived on happens to be, and animating to it from the left
    edge of the dock would draw a marker sliding across a bar nobody has
    touched yet.
  */
  const [travels, setTravels] = useState(false);

  const measure = useCallback(() => {
    const row = rowRef.current;
    if (!row) return;
    const on = row.querySelector<HTMLElement>('[data-room][aria-current="page"]');
    setMark(on ? { left: on.offsetLeft, width: on.offsetWidth } : null);
  }, []);

  useLayoutEffect(() => {
    measure();
  }, [measure, pathname]);

  /*
    The cells change width without the pathname changing: the labels arrive
    with the font at `md`, and the whole shape swaps at the breakpoint. A
    marker measured once is a marker sitting beside the wrong cell after
    either.
  */
  useEffect(() => {
    const row = rowRef.current;
    if (!row || typeof ResizeObserver === "undefined") return;
    const watch = new ResizeObserver(() => measure());
    watch.observe(row);
    for (const cell of Array.from(row.children)) watch.observe(cell);
    return () => watch.disconnect();
  }, [measure]);

  useEffect(() => {
    if (!mark || travels) return;
    const frame = requestAnimationFrame(() => setTravels(true));
    return () => cancelAnimationFrame(frame);
  }, [mark, travels]);

  const hush = useRef<ReturnType<typeof setTimeout> | null>(null);

  const say = useCallback((label: string, cell: HTMLElement) => {
    setSaid({ label, left: cell.offsetLeft + cell.offsetWidth / 2 });
    if (hush.current) clearTimeout(hush.current);
    hush.current = setTimeout(() => setSaid(null), SAY_MS);
  }, []);

  useEffect(() => {
    return () => {
      if (hush.current) clearTimeout(hush.current);
    };
  }, []);

  return (
    <div
      ref={rowRef}
      /*
       * `glass-dock` after `card-sheen glass`: the same pane, with the chrome
       * fill and a harder blur in place of the card veil. It overrides the
       * body and the blur only, so the rim, the ring and the lift shadow are
       * still the ones every other pane in the app carries. The measurement,
       * and where the 55% comes from, is in globals.css.
       */
      className="card-sheen glass glass-dock pointer-events-auto relative flex w-fit items-center gap-1 rounded-full p-1 ring-1 ring-foreground/20"
    >
      {ROOMS.map(({ href, label, icon: Icon, me: isMe }) => {
        const active =
          pathname != null && (pathname === href || pathname.startsWith(`${href}/`));

        return (
          <Link
            key={href}
            href={href}
            data-room={href}
            aria-label={label}
            aria-current={active ? "page" : undefined}
            onPointerDown={(event) => say(label, event.currentTarget)}
            /*
             * A keyboard never presses anything, so the name would never be
             * spoken to somebody tabbing along the dock. Focus is that
             * person's press. It costs nothing on a desktop, where the chip
             * is not drawn at all and the label is already painted.
             */
            onFocus={(event) => say(label, event.currentTarget)}
            className={cn(
              "relative z-[1] flex size-12 shrink-0 items-center justify-center rounded-full text-sm font-medium transition-colors",
              "md:w-auto md:gap-2 md:px-4",
              "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
              active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {isMe ? me : <Icon className="size-5 shrink-0" aria-hidden="true" />}
            <span className="hidden leading-none md:inline">{label}</span>
          </Link>
        );
      })}

      {/*
        The marker. One element, behind the cells, measured off the live cell
        and moved with a transform so it costs no layout and cannot shift the
        row under a thumb.
      */}
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute top-1 left-0 h-12 rounded-full bg-foreground/10",
          mark ? "opacity-100" : "opacity-0",
          travels ? "transition-[transform,width,opacity] duration-300" : "transition-none",
          "motion-reduce:transition-none"
        )}
        style={
          mark
            ? {
                width: `${mark.width}px`,
                transform: `translateX(${mark.left}px)`,
                transitionTimingFunction: SLIDE,
              }
            : undefined
        }
      />

      {/*
        The name, spoken on the press.

        `md:hidden` rather than a second condition in the component: above the
        breakpoint the label is painted inside the cell, and a chip repeating
        it would be the same word twice.
      */}
      <span
        aria-hidden="true"
        className={cn(
          "glass glass-dock pointer-events-none absolute bottom-full mb-2 -translate-x-1/2 rounded-full px-3 py-1 text-xs font-medium whitespace-nowrap text-foreground ring-1 ring-foreground/20 md:hidden",
          "transition-opacity duration-150 motion-reduce:transition-none",
          said ? "opacity-100" : "opacity-0"
        )}
        style={{ left: `${said?.left ?? 0}px` }}
      >
        {said?.label ?? " "}
      </span>
    </div>
  );
}
