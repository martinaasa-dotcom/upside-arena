"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { track } from "@/lib/analytics";
import type { EarnedReward } from "@/lib/game/streaks";

/*
  The moment a title is earned.

  Announced once, on the render it happened. A reward that quietly appears in
  a list is not a reward, and one that announces itself every time you look is
  an annoyance.
*/
export function EarnedToast({ earned }: { earned: EarnedReward[] }) {
  const announced = useRef(new Set<string>());

  useEffect(() => {
    for (const reward of earned) {
      if (announced.current.has(reward.id)) continue;
      announced.current.add(reward.id);
      track("reward_earned", { reward: reward.id });
      toast.success(`You earned "${reward.name}"`, {
        description: reward.description,
        duration: 6000,
      });
    }
  }, [earned]);

  return null;
}
