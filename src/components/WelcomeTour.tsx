"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ArenaWordmark } from "@/components/brand/ArenaWordmark";
import { finishTour } from "@/app/(app)/actions";
import { cn } from "@/lib/utils";
import { STEPS, type Step } from "@/lib/tour-steps";

/*
  The walkthrough somebody gets on their way in.

  Arena had two explanations of itself and a person could sign in without
  meeting either. `/how` is long, good, and signed out on purpose -- it is the
  page you send somebody, not the page you land on. The onboarding screen has
  three lines above a name field, read by a person whose whole attention is on
  the name field. Between them was the actual gap: somebody arrives at Home
  with a hundred thousand pretend dollars, five rooms they have never been
  told about, and no idea what the second number on the scoreboard means.

  So this says the whole thing, once, in the app, to everybody -- and then
  never again. Its rules:

    Every screen is the same shape: progress, where you are, a heading, a
    sentence, the things, the same footer. Nothing moves between steps except
    the words, because a walkthrough whose buttons wander is one somebody has
    to re-read the bottom of eight times.

    Nothing here is a figure this file made up. The starting balance, the
    lineup size, the season threshold, the notification cap and the rooms are
    all imported from what the game is played by, so the walkthrough cannot
    end up describing a game Arena stopped being.

    Closing it counts as reading it. Escape, the X, and "Skip the tour" all
    write the same version down, because a walkthrough that comes back
    tomorrow because you dismissed it today is a nag with a progress bar.

    The one thing it never does is stand between a person and the room. It
    opens over Home with Home already painted behind it.

  `TourScreen` is exported on its own so every screen is in /gallery, which is
  what tests/e2e/clipping.spec.ts measures at every width a phone reports. A
  modal is the easiest thing in an app to ship broken on a phone -- nobody
  sees it twice -- and it was the one family of component the probe could not
  reach.
*/

/*
  The row treatment, which is not `CARD`.

  `CARD` is `glass-well`: the quiet nested material, keyed to `--muted` and
  carrying nothing but a hairline. That is right for a well inside a panel,
  where the panel around it is already the glass. Inside the walkthrough
  there is no panel around it -- the rows sit straight on the dialog over an
  80% scrim -- and `glass-well` on that reads as a flat grey box, which is
  the one thing this app's surfaces are not.

  So the rows take the top-level material instead: `.glass` for the blur and
  the 66% fill, `card-sheen` for the three specular terms that are what
  actually sell it as glass on a near-black field. Padding stays on the
  element rather than in the constant, because a row is a row and not a
  panel.
*/
const ROW_GLASS = "card-sheen glass rounded-lg p-4";

/**
 * One screen, with no idea it is in a dialog.
 *
 * Split out from the dialog so /gallery can render all eight of them in the
 * page flow, where the clipping probe measures every element at every phone
 * width. What it is inside is the dialog's business.
 */
export function TourScreen({
  step,
  index,
  total,
  headingId,
  Title = "h2",
  Description = "p",
  children,
}: {
  step: Step;
  index: number;
  total: number;
  /** So the dialog can point `aria-labelledby` at the heading on every step. */
  headingId?: string;
  /*
    What the heading and the sentence under it are made of.

    `DialogTitle` and `DialogDescription` throw outside a `Dialog`, and half
    the point of this component is being rendered in /gallery where there
    isn't one. So the live tour passes the Radix pair and the gallery takes
    the plain elements — same markup, same classes, and Radix still gets the
    title it insists a dialog has.
  */
  Title?: React.ElementType;
  Description?: React.ElementType;
  /** The footer, which only the live tour has. */
  children?: React.ReactNode;
}) {
  const rows = step.rows ?? [];

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      {/*
        Lockup first, then the bar and the count. The rooms keep the mark in
        a glass bar at the top of the window; this screen is a dialog over
        that bar, so the lockup has to live here or it is gone. `pe-9` keeps
        the row clear of the dialog's close button, which the primitive draws
        in this corner at `top-4 right-4`. Reserved unconditionally rather
        than passed in, so /gallery measures the same header a person is
        actually looking at.
      */}
      <div className="flex shrink-0 flex-col gap-3 pe-9">
        <ArenaWordmark />
        <div className="flex flex-col gap-2">
          <div className="flex gap-1.5" aria-hidden="true">
            {Array.from({ length: total }, (_, i) => (
              <span
                key={i}
                className={cn(
                  "h-1 min-w-0 flex-1 rounded-full transition-colors",
                  i <= index ? "bg-primary" : "bg-muted"
                )}
              />
            ))}
          </div>
          <p className="text-sm tabular-nums text-muted-foreground">
            Step {index + 1} of {total} · {step.key}
          </p>
        </div>
      </div>

      {/*
        The one scroller. Everything that can grow with the copy is inside it,
        and the progress above and the footer below are pinned either side,
        so the way forward is on screen at every width, and the eighth screen
        on a 320px phone scrolls its own text rather than pushing the button
        off the bottom of the world. `scroll-host` keeps that bar in a track.
        The negative end margin parks the track in the dialog pad so the rows
        line up with the progress, not inset from it. End only: there is no
        bar on the start edge, and pulling that side into the pad would
        catch leftover pan gestures in empty glass.
      */}
      <div className="scroll-host -me-4 pe-4 sm:-me-6 sm:pe-6 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
        <div className="flex flex-col gap-2">
          <Title id={headingId} className="text-lg font-semibold tracking-tight">
            {step.title}
          </Title>
          <Description className="text-sm leading-relaxed text-muted-foreground">
            {step.lede}
          </Description>
        </div>

        {rows.length > 0 ? (
          /*
            Two columns once there are more than two of them and there is room.
            A desktop reading five one-line rooms down a single narrow column
            is a lot of white either side of very little; a phone reading two
            columns is two words per line.
          */
          <ul
            className={cn(
              "grid gap-2",
              rows.length > 2 && "sm:grid-cols-2"
            )}
          >
            {rows.map((row) => {
              const Icon = row.icon;
              return (
                <li key={row.term} className={cn(ROW_GLASS, "flex items-start gap-3")}>
                  <Icon
                    className="mt-0.5 size-4 shrink-0 text-primary"
                    aria-hidden="true"
                  />
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-sm font-medium">{row.term}</span>
                    <span className="text-sm text-muted-foreground">{row.text}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        ) : null}

        {step.note ? (
          <p className="text-sm text-muted-foreground">{step.note}</p>
        ) : null}
      </div>

      {children}
    </div>
  );
}

const HEADING_ID = "welcome-tour-title";

export function WelcomeTour({ playerName }: { playerName: string | null }) {
  const [open, setOpen] = useState(true);
  const [index, setIndex] = useState(0);
  const [, startSaving] = useTransition();

  const step = STEPS[index]!;
  const last = index === STEPS.length - 1;

  /*
    Written down once, whichever way it ends. `finishTour` is idempotent, but
    Escape firing while the "Start playing" transition is already in flight
    would send a second write for no reason, so the guard is here rather than
    there.
  */
  const [closed, setClosed] = useState(false);
  const close = useCallback(() => {
    setOpen(false);
    if (closed) return;
    setClosed(true);
    startSaving(() => {
      void finishTour();
    });
  }, [closed]);

  /*
    Arrow keys, because eight screens is enough that somebody will try. Radix
    already owns Escape and the tab ring; this only adds the two it does not.
  */
  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "ArrowRight") {
        setIndex((i) => Math.min(i + 1, STEPS.length - 1));
      } else if (event.key === "ArrowLeft") {
        setIndex((i) => Math.max(i - 1, 0));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) close();
      }}
    >
      <DialogContent
        aria-labelledby={HEADING_ID}
        /*
          A height and a floor under it. Without the height the eighth screen
          on a short phone runs off both ends of the viewport with the button
          somewhere below the fold; `dvh` rather than `vh` because a phone
          browser's chrome is part of the difference. The padding steps down
          on a phone the way every other surface in the app does.
        */
        className="flex max-h-[calc(100dvh-2rem)] w-full max-w-[calc(100%-2rem)] flex-col gap-0 p-4 sm:max-w-2xl sm:p-6"
        /*
          Clicking the page behind a walkthrough is somebody reaching for the
          room, not somebody dismissing eight screens they have not read. The
          X, Escape and the skip link are all still there and all still count.
        */
        onInteractOutside={(event) => event.preventDefault()}
      >
        <TourScreen
          step={index === 0 && playerName ? withGreeting(step, playerName) : step}
          index={index}
          total={STEPS.length}
          headingId={HEADING_ID}
          Title={DialogTitle}
          Description={DialogDescription}
        >
          {/*
            One footer, the same on every screen: back on the left where it is
            ignorable, the way forward on the right where the thumb is, and
            the long version as the quietest thing on it.

            A grid on a phone and a row from `sm` up, rather than one wrapping
            row. Wrapping put the three of them on two lines with the primary
            button at the bottom *left*, which is the one place the way
            forward should never be. Two columns keeps back and next at the
            ends of the same line at 320px and drops the link underneath them.
          */}
          <div className="grid shrink-0 grid-cols-2 items-center gap-x-3 gap-y-2 border-t border-border pt-4 sm:flex">
            {index > 0 ? (
              <Button
                variant="ghost"
                className="justify-self-start"
                onClick={() => setIndex(index - 1)}
              >
                Back
              </Button>
            ) : (
              <Button variant="ghost" className="justify-self-start" onClick={close}>
                Skip the tour
              </Button>
            )}
            <Button
              className="justify-self-end sm:order-last"
              onClick={() => (last ? close() : setIndex(index + 1))}
            >
              {last ? "Start playing" : "Next"}
            </Button>
            {/*
              A `Button asChild`, not a bare link. Beside two buttons in a
              footer, a 20px-tall tap target is the one a thumb misses — and
              the size variants are where this app puts its touch targets.
            */}
            <Button
              asChild
              variant="link"
              className="col-span-2 justify-self-center text-muted-foreground sm:col-span-1 sm:ms-auto sm:justify-self-auto"
            >
              <Link href="/how" onClick={close}>
                The long version
              </Link>
            </Button>
          </div>
        </TourScreen>
      </DialogContent>
    </Dialog>
  );
}

/** "Welcome, Martin." in front of the first heading, and nowhere else. */
function withGreeting(step: Step, name: string): Step {
  return { ...step, title: `Welcome, ${name}. ${step.title}` };
}
