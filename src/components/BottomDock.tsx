"use client";

import { Suspense } from "react";
import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { ROOMS } from "@/lib/rooms";

/*
  Bottom dock, on desktop and phone alike. Active tab is the aqua pill
  with black type. Rooms are added here as later phases land, never before the
  room exists: a dead tab is worse than a short dock.

  It is two shapes, not one, and the breakpoint is `md` in both apps.

  Below it the dock is the phone's: the full width of the screen inside the
  page gutter, equal cells, the glyph above the label. That is the shape a
  phone tab bar has, and the width matters as much as the stacking -- a
  content-hugging pill on a 390px screen leaves dead bands either side of it
  and reads as a control that happens to be near the bottom rather than as the
  floor of the app.

  At `md` and up it is the desktop's: content-hugging, centred, glyph beside
  label. Stretching five cells across a 1440px column would leave each label
  floating in the middle of a 230px chip and turn the active one into a slab
  of accent the width of a paragraph.

  Concentric corners, both ways round: the pill is `rounded-xl` (12px) with
  `p-1` (4px), so the cells inside it are `rounded-lg` (8px). 12 - 4 = 8. A
  cell with the same radius as the shell around it reads as a sticker on it.

  The labels used to hide below 544px, which is to say on every phone anyone
  owns, leaving five unlabelled glyphs. A trophy is not a word: nothing about
  it says Leagues rather than Season, and a tab bar is the one place in an app
  where a person has to be right first time. They are on at every width now,
  which is what the stacked cell is for -- the width a label needs beside a
  glyph is what forced the choice, and above it there is none to force.
*/

/*
  A tap has to be answered on the frame it lands on.

  Every room reads live data, so the answer to a tap comes from the server, and
  until it arrives the pathname has not changed and no tab looks any different.
  That is the whole of what "the dock feels slow" was: the tab you pressed
  carried on looking unpressed while a request was in flight, so the app read
  as having ignored you rather than as having been asked something hard.

  Every room now has a loading boundary, so the pressed tab usually becomes the
  real active tab within a frame or two. This covers what is left: a cold
  prefetch, a slow connection, a tab pressed twice.

  It is drawn as a fill behind the tab rather than as a change to the tab, so
  it costs no layout and cannot move the row under a thumb. It is deliberately
  not the aqua pill and does not touch aria-current: this says "heard you", not
  "you are here", and a navigation that is interrupted or abandoned must not
  leave the dock claiming somewhere you never went.
*/
function PressedFill() {
  const { pending } = useLinkStatus();

  return (
    <span
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 rounded-lg bg-foreground/10 transition-opacity duration-150",
        pending ? "opacity-100" : "opacity-0"
      )}
    />
  );
}

/*
  The dock itself is the same on every room, so it is part of the prerendered
  shell. Which tab is lit is not: that is the URL, and one shell is served for
  all of them. So the row of tabs waits behind a boundary and the fallback
  draws the same row with none of them lit.

  On a tap between rooms this resolves in the same frame -- the router already
  holds the new pathname, so the hook does not suspend at all. It is only a
  cold arrival that ever sees the unlit row, and only for as long as the first
  bytes take.
*/
export function BottomDock() {
  return (
    <nav
      aria-label="Rooms"
      /*
       * `data-dock` is how anything else on the page finds out there is a
       * dock at the bottom of it. Asking the dock beats keeping a list of
       * the routes that have one: the dock renders from (app)/layout, so it
       * is on every room in the group, while any list is of something else
       * and drifts from this the moment the two disagree.
       */
      data-dock
      /*
       * `pointer-events-none` because this element spans the whole viewport
       * while only the pill inside it draws anything. A fixed element
       * captures clicks across its entire box whether or not it paints, so
       * without this the empty band either side of the dock swallowed every
       * click along the bottom of the page -- including the "Make your first
       * trade" button that sits in the bottom-right corner of /home, which
       * simply did nothing. The pill turns them back on.
       *
       * The gutter is the page's own 16px on a phone and nothing at `md`,
       * where the pill sizes itself and centres instead.
       */
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:px-0"
    >
      <div
        /*
         * `glass-dock` after `card-sheen glass`: the same pane, with the
         * chrome fill and a harder blur in place of the card veil. It
         * overrides the body and the blur only, so the rim, the ring and the
         * lift shadow are still the ones every other pane in the app carries.
         * The measurement, and where the 50% comes from, is in globals.css.
         */
        className={cn(
          "card-sheen glass glass-dock pointer-events-auto mx-auto grid w-full gap-1 rounded-xl p-1 ring-1 ring-foreground/20",
          "md:flex md:w-fit md:items-center"
        )}
        style={{
          gridTemplateColumns: `repeat(${ROOMS.length}, minmax(0, 1fr))`,
        }}
      >
        <Suspense fallback={<Tabs pathname={null} />}>
          <ActiveTabs />
        </Suspense>
      </div>
    </nav>
  );
}

function ActiveTabs() {
  return <Tabs pathname={usePathname()} />;
}

function Tabs({ pathname }: { pathname: string | null }) {
  return (
    <>
      {ROOMS.map(({ href, label, icon: Icon }) => {
        const active =
          pathname != null && (pathname === href || pathname.startsWith(`${href}/`));
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex h-12 min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg px-0.5 text-xs font-medium transition-colors",
              "md:h-11 md:flex-row md:gap-2 md:px-4 md:text-sm",
              "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
          >
            {active ? null : <PressedFill />}
            <Icon className="relative size-4 shrink-0" aria-hidden="true" />
            <span className="relative max-w-full leading-none">{label}</span>
          </Link>
        );
      })}
    </>
  );
}
