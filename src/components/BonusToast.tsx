"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { track } from "@/lib/analytics";
import type { StreakBonus } from "@/lib/game/streaks";

/*
  The milestone reveal.

  Section 3 puts a ritualised reveal moment on the list of things that work,
  and it is legitimate here for one reason: the thing being revealed already
  happened. The player turned up for five trading days. The animation is
  dressing on a real outcome, not a chance event dressed as one.

  What varies is how much a milestone paid. What never varies is that it paid,
  so there is no version of this that shows somebody a disappointing spin.
*/
export function BonusToast({ bonuses }: { bonuses: StreakBonus[] }) {
  const announced = useRef(new Set<number>());

  useEffect(() => {
    for (const bonus of bonuses) {
      if (announced.current.has(bonus.day)) continue;
      announced.current.add(bonus.day);

      track("streak_bonus_paid", { day: bonus.day, coins: bonus.coins });

      const days = `${bonus.day} trading days`;

      if (bonus.drop) {
        toast.success(`${days}. Here is "${bonus.drop.name}"`, {
          description:
            bonus.coins > 0
              ? `Yours to wear, and ${bonus.coins} coins with it. Both for turning up.`
              : "Yours to wear, for turning up.",
          duration: 8000,
        });
        continue;
      }

      if (bonus.coins > 0) {
        toast.success(`${days}. ${bonus.coins} coins`, {
          description: "For turning up. Spend them on the Plus screen.",
          duration: 6000,
        });
      }
    }
  }, [bonuses]);

  return null;
}
