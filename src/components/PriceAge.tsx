"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { priceAgeLabel } from "@/lib/format";

/*
  How far behind the prices are, when they are behind at all.

  This replaced a badge in the caution colour reading "Prices are catching
  up", which was the loudest thing on the screen for a condition nobody can
  act on. A player cannot make the upstream answer, so the alarm was asking
  them to feel something rather than telling them anything. What is actually
  useful is the reading itself: how old the number beside it is.

  It renders nothing at all while prices are current, and current is the
  ordinary case: quotes live for sixty seconds, so an always-on age would
  read "less than a minute" every time anybody looked at it, which is a
  label that has never once told a reader something they did not know.

  It ticks because it has to. The room is a server component and does not
  re-render itself, so a reading baked at request time only understates as
  the page sits open, and a stale figure about staleness is the one thing
  this must not be.

  Both sides read their own clock, which is why the badge suppresses the
  hydration warning rather than seeding from the timestamp. Seeding would
  agree on both sides by construction and paint "1m" first, understating a
  gap of any size for exactly as long as it takes an effect to run after a
  paint. Two clocks a few seconds apart is what this element is for; the
  server's answer is the true age at request time, and the first tick after
  mount replaces it with the client's.
*/

/** Slow enough to be free, fast enough that the reading is never a lie. */
const TICK_MS = 30_000;

export function PriceAge({ since }: { since: number }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const read = () => setNow(Date.now());
    read();

    const id = window.setInterval(() => {
      if (!document.hidden) read();
    }, TICK_MS);

    // A phone that was in a pocket comes back to a reading minutes out.
    document.addEventListener("visibilitychange", read);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", read);
    };
  }, []);

  return (
    <Badge variant="outline" suppressHydrationWarning>
      {priceAgeLabel(now - since)}
    </Badge>
  );
}
