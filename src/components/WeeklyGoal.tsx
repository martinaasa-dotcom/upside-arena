"use client";

import { useState, useTransition } from "react";
import { Check, Flag, Minus, X } from "lucide-react";
import { toast } from "sonner";
import { Panel, Well } from "@/components/Panel";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { submitGoal, submitWithdrawGoal } from "@/app/(app)/leagues/actions";
import { track } from "@/lib/analytics";
import { GOALS, type GoalKind } from "@/lib/game/goal-kinds";

/*
  Saying what you are going to do this week, to the people who will see it.

  Section 3 lists public commitment as one of the levers that genuinely works,
  and this is the whole of it: a choice from four, said once, visible to the
  league, worth nothing at all.

  Two things it deliberately is not. It is not typed, because free text in
  somebody else's league is a moderation surface this product has no tooling
  for. And it is not editable, because a goal you can quietly change on Friday
  once you know how the week went is a scoreboard drawn afterwards.
*/
export function WeeklyGoal({
  leagueId,
  declared,
}: {
  leagueId: string;
  declared: GoalKind | null;
}) {
  const [chosen, setChosen] = useState<GoalKind | null>(null);
  const [busy, startTransition] = useTransition();

  function declare() {
    if (!chosen) return;

    startTransition(async () => {
      const result = await submitGoal(leagueId, chosen);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      track("goal_declared", { goal: chosen });
      toast.success("Said. Your league can see it.");
    });
  }

  function withdraw() {
    startTransition(async () => {
      const result = await submitWithdrawGoal(leagueId);

      /*
        Only said once it is true. This claimed the goal was taken back and
        that nothing was recorded whatever happened, and a goal everybody in
        the league can see is the wrong thing to be wrong about: the player
        walks away believing they withdrew it while it is still there under
        their name.
      */
      if (!result.ok) {
        toast.error("We could not take that back. Try again.");
        return;
      }

      track("goal_withdrawn");
      toast.success("Taken back. Nothing was recorded.");
    });
  }

  if (declared) {
    const goal = GOALS.find((entry) => entry.kind === declared);

    return (
      <Panel
        title="What you said you would do"
        description="Your league can see this. It is worth nothing and costs nothing, which is the point of saying it."
      >
        <div className="flex flex-wrap items-center gap-3">
          <Well className="flex flex-1 items-center gap-3 py-3">
            <Flag className="size-4 shrink-0 text-primary" aria-hidden="true" />
            <span className="flex min-w-0 flex-col">
              <span className="text-sm font-medium">{goal?.label}</span>
              <span className="text-sm text-muted-foreground">
                {goal?.detail}
              </span>
            </span>
          </Well>

          <Button variant="ghost" size="sm" disabled={busy} onClick={withdraw}>
            <X className="size-4" aria-hidden="true" />
            Take it back
          </Button>
        </div>
      </Panel>
    );
  }

  return (
    <Panel
      title="Say what you are doing this week"
      description="To this league, once, for the week. It changes no score and earns nothing. People who say it out loud do it more often, and that is the only reason it is here."
    >
      <div className="flex flex-col gap-3">
        <div
          role="radiogroup"
          aria-label="This week's goal"
          className="grid gap-2 sm:grid-cols-2"
        >
          {GOALS.map((goal) => {
            const active = goal.kind === chosen;

            return (
              <button
                key={goal.kind}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setChosen(goal.kind)}
                className={cn(
                  "flex flex-col items-start gap-0.5 rounded-lg border px-4 py-3 text-left transition-colors",
                  active
                    ? "border-primary bg-primary/10"
                    : "border-border hover:bg-foreground/5"
                )}
              >
                <span className="text-sm font-medium">{goal.label}</span>
                <span className="text-xs text-muted-foreground">
                  {goal.detail}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button disabled={busy || !chosen} onClick={declare}>
            Say it
          </Button>
          <p className="text-sm text-muted-foreground">
            You can take it back, but you cannot swap it for a different one.
          </p>
        </div>
      </div>
    </Panel>
  );
}

/** How a goal is shown next to somebody in the table. */
export function GoalMark({
  label,
  met,
}: {
  label: string;
  met: boolean | null;
}) {
  const Icon = met === true ? Check : met === false ? X : Minus;

  return (
    <span
      className={cn(
        "flex items-center gap-1.5 text-xs",
        met === true
          ? "text-gain"
          : met === false
            ? "text-muted-foreground"
            : "text-muted-foreground"
      )}
    >
      <Icon className="size-3 shrink-0" aria-hidden="true" />
      {label}
      {met === null ? (
        // Not a failure. The week has simply not decided yet, and marking
        // somebody as having missed on a Tuesday would be a fabricated
        // near-miss.
        <span className="sr-only">, still going</span>
      ) : null}
    </span>
  );
}
