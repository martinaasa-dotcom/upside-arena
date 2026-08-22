"use client";

import { useActionState, useState } from "react";
import { Swords } from "lucide-react";
import { Panel, Well } from "@/components/Panel";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { track } from "@/lib/analytics";
import { FORMATS, type FormatId } from "@/lib/game/formats";
import { LENGTHS, type LengthId } from "@/lib/game/lengths";
import {
  submitStartBattle,
  type BattleState,
} from "@/app/(app)/leagues/battle-actions";

/*
  Choosing what the league plays next.

  Two choices and nothing else: a rule book and a length. Everything a format
  changes is written on its own card in the words somebody is going to be held
  to, because a rule discovered by being refused a trade is a rule that reads
  as a bug.

  Any member may start one. A league where one person picks the game and four
  people are told what they are playing is a league where one person is
  playing.
*/
export function StartBattleForm({ leagueId }: { leagueId: string }) {
  const [state, formAction, pending] = useActionState<BattleState, FormData>(
    submitStartBattle,
    {}
  );
  const [format, setFormat] = useState<FormatId>("silicon");
  const [length, setLength] = useState<LengthId>("week");

  const chosen = FORMATS.find((entry) => entry.id === format);

  return (
    <Panel
      title="Start a battle"
      description="A second contest beside the ordinary week, with its own rules and its own length. Everybody in this league is in it, everybody starts level, and nothing about it touches your record."
    >
      <form action={formAction} className="flex flex-col gap-5">
        <input type="hidden" name="leagueId" value={leagueId} />
        <input type="hidden" name="format" value={format} />
        <input type="hidden" name="length" value={length} />

        <div className="flex flex-col gap-2">
          <span id="battle-format-label" className="text-sm leading-none font-medium">
            The rule book
          </span>
          <div
            role="radiogroup"
            aria-labelledby="battle-format-label"
            className="grid gap-2 sm:grid-cols-2"
          >
            {FORMATS.map((entry) => {
              const active = entry.id === format;
              return (
                <button
                  key={entry.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setFormat(entry.id)}
                  className={cn(
                    "flex items-start gap-3 rounded-lg border px-4 py-3 text-left transition-colors",
                    active
                      ? "border-primary bg-primary/10"
                      : "border-border hover:bg-foreground/5"
                  )}
                >
                  <span className="text-lg leading-none" aria-hidden="true">
                    {entry.icon}
                  </span>
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-sm font-medium">{entry.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {entry.tagline}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {chosen ? (
          <Well className="flex flex-col gap-1 py-3">
            <p className="text-sm">
              <span className="font-medium">The rule:</span> {chosen.rule}
            </p>
            <p className="text-sm text-muted-foreground">
              Measured against {chosen.benchmark}, so beating the whole market in a
              week your corner of it ran is not a result.
            </p>
          </Well>
        ) : null}

        <div className="flex flex-col gap-2">
          <span id="battle-length-label" className="text-sm leading-none font-medium">
            How long
          </span>
          <div
            role="radiogroup"
            aria-labelledby="battle-length-label"
            className="grid gap-2 sm:grid-cols-3"
          >
            {LENGTHS.map((entry) => {
              const active = entry.id === length;
              return (
                <button
                  key={entry.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setLength(entry.id)}
                  className={cn(
                    "flex flex-col items-start gap-0.5 rounded-lg border px-4 py-3 text-left transition-colors",
                    active
                      ? "border-primary bg-primary/10"
                      : "border-border hover:bg-foreground/5"
                  )}
                >
                  <span className="text-sm font-medium">{entry.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {entry.tagline}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {state.error ? (
          <p role="alert" className="text-sm text-loss">
            {state.error}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="submit"
            size="lg"
            disabled={pending}
            onClick={() => track("battle_started", { format, length })}
          >
            <Swords className="size-4" aria-hidden="true" />
            {pending ? "Starting" : "Start it"}
          </Button>
          <p className="text-sm text-muted-foreground">
            One battle at a time per league. You can call it off while it runs.
          </p>
        </div>
      </form>
    </Panel>
  );
}
