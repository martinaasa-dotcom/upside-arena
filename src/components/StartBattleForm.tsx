"use client";

import { useActionState, useState } from "react";
import { Swords } from "lucide-react";
import { Panel, Well } from "@/components/Panel";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/Segmented";
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
  const chosenLength = LENGTHS.find((entry) => entry.id === length) ?? LENGTHS[1];

  return (
    <Panel
      title="Start a battle"
      description="A second contest beside the ordinary week, with its own rules and its own length. Everybody in this league is in it, everybody starts level, and nothing about it touches your record."
    >
      <form action={formAction} className="flex flex-col gap-5">
        <input type="hidden" name="leagueId" value={leagueId} />
        <input type="hidden" name="format" value={format} />
        <input type="hidden" name="length" value={length} />

        {/*
          Twelve tiles rather than twelve cards.

          This was a card each with a name and a line under it, and six more
          for the lengths, which on a 390px screen came to two thousand pixels
          of scrolling before the button. Nobody reads eighteen descriptions to
          make two choices. The tiles carry the icon and the name, and what the
          chosen one actually means is said once, underneath, where somebody is
          looking after they have chosen it.
        */}
        <div className="flex flex-col gap-2">
          <span id="battle-format-label" className="text-sm leading-none font-medium">
            The rule book
          </span>
          <div
            role="radiogroup"
            aria-labelledby="battle-format-label"
            className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4"
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
                    "flex min-h-14 items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-colors",
                    "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                    active
                      ? "border-primary bg-primary/10"
                      : "border-border hover:bg-foreground/5"
                  )}
                >
                  <span className="shrink-0 text-lg leading-none" aria-hidden="true">
                    {entry.icon}
                  </span>
                  <span className="min-w-0 text-sm leading-tight font-medium">
                    {entry.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {chosen ? (
          <Well className="flex flex-col gap-1 py-3">
            <p className="text-sm">
              <span className="font-medium">{chosen.name}.</span> {chosen.rule}
            </p>
            <p className="text-sm text-muted-foreground">
              Measured against {chosen.benchmark}, so beating the whole market in a
              week your corner of it ran is not a result.
              {chosen.tradingHours === "always"
                ? " This one runs through the weekend."
                : ""}
            </p>
          </Well>
        ) : null}

        <div className="flex flex-col gap-2">
          <span id="battle-length-label" className="text-sm leading-none font-medium">
            How long
          </span>
          <Segmented
            label="How long the battle runs"
            options={LENGTHS.map((entry) => ({
              value: entry.id,
              label: entry.short,
            }))}
            value={length}
            onValueChange={setLength}
          />
          <p className="text-sm text-muted-foreground">
            <span className="text-foreground">{chosenLength.name}.</span>{" "}
            {chosenLength.tagline}
          </p>
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
