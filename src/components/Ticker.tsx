"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { formatMoney, formatPercent } from "@/lib/format";

/*
  A number that moves to its new value instead of jumping to it, and flashes
  briefly in the direction it moved.

  Section 4 asks for this and then warns against overdoing it, which is the
  harder half. So: a short animation, a flash that fades, and nothing that
  loops or pulses forever. A number that will not sit still is a number nobody
  can read, and this screen is mostly numbers.

  Anybody who has asked their system not to animate things gets the value,
  instantly, with no flash. That is a preference about pain and nausea, not a
  decoration setting.
*/

const DURATION_MS = 550;
const FLASH_MS = 900;

function prefersStillness() {
  if (typeof window === "undefined") return true;
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

/*
  How to draw it, chosen by name rather than by passing a function.

  These are rendered from server components, and a function is not something
  that can cross that boundary. Naming the format keeps the whole thing a
  plain string prop.
*/
const FORMATS = {
  money: (value: number) => formatMoney(value),
  percent: (value: number) => formatPercent(value),
  plain: (value: number) => Math.round(value).toLocaleString("en-GB"),
} as const;

export function Ticker({
  value,
  format = "money",
  className,
}: {
  value: number;
  format?: keyof typeof FORMATS;
  className?: string;
}) {
  const [shown, setShown] = useState(value);
  const [flash, setFlash] = useState<"none" | "up" | "down">("none");
  const from = useRef(value);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    if (value === from.current) return;

    const start = from.current;
    const delta = value - start;

    /*
      Everything below runs from a frame callback or a timer rather than
      straight out of the effect body. Setting state synchronously here would
      make React render twice for every tick, which on a screen of numbers
      that all move together is a lot of wasted renders.
    */
    if (prefersStillness()) {
      from.current = value;
      frame.current = requestAnimationFrame(() => setShown(value));
      return () => {
        if (frame.current) cancelAnimationFrame(frame.current);
      };
    }

    const flashOn = window.setTimeout(() => setFlash(delta > 0 ? "up" : "down"), 0);
    const flashTimer = window.setTimeout(() => setFlash("none"), FLASH_MS);

    const began = performance.now();
    const step = (now: number) => {
      const progress = Math.min(1, (now - began) / DURATION_MS);
      // Eased out, so it arrives rather than stops dead.
      const eased = 1 - Math.pow(1 - progress, 3);
      setShown(start + delta * eased);

      if (progress < 1) frame.current = requestAnimationFrame(step);
      else from.current = value;
    };

    frame.current = requestAnimationFrame(step);

    return () => {
      window.clearTimeout(flashOn);
      window.clearTimeout(flashTimer);
      if (frame.current) cancelAnimationFrame(frame.current);
      // Land on the truth even if this unmounts part way.
      from.current = value;
    };
  }, [value]);

  return (
    <span
      className={cn(
        "transition-colors duration-300",
        flash === "up" && "text-gain",
        flash === "down" && "text-loss",
        className
      )}
    >
      {FORMATS[format](shown)}
    </span>
  );
}
