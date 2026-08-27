"use client";

import { useActionState, useMemo, useState } from "react";
import { Swords } from "lucide-react";
import { Panel, Well } from "@/components/Panel";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/Segmented";
import { cn } from "@/lib/utils";
import { track } from "@/lib/analytics";
import { FORMATS, formatById, isPartyFormat, type FormatId } from "@/lib/game/formats";
import { LENGTHS, lengthById, type LengthId } from "@/lib/game/lengths";
import {
  CADENCES,
  cadenceById,
  cadencesFor,
  suggestedCadence,
  type CadenceId,
} from "@/lib/game/cadence";
import {
  DEFAULT_TEMPLATE,
  TEMPLATES,
  matchingTemplate,
  templateById,
  templateHorizon,
  type TemplateId,
} from "@/lib/game/templates";
import {
  submitStartBattle,
  type BattleState,
} from "@/app/(app)/leagues/battle-actions";

/*
  Choosing what the league plays next.

  Three knobs, or a recipe that sets all three. A format is the rule book, a
  length is how long it runs, and a cadence is when anybody may buy. Selling
  is never gated by the third one: a year that trapped somebody in a name
  they no longer wanted would not be a longer game, it would be a worse one.

  Recipes exist because nobody reads eighteen descriptions to make three
  choices. The tiles name the game; the well under them says the rule. Mix
  your own is still there, because the stupid game a league actually wants
  is rarely the one on a card.
*/

type Mode = "recipe" | "custom";

export function StartBattleForm({ leagueId }: { leagueId: string }) {
  const [state, formAction, pending] = useActionState<BattleState, FormData>(
    submitStartBattle,
    {}
  );
  const [mode, setMode] = useState<Mode>("recipe");
  const [templateId, setTemplateId] = useState<TemplateId>(DEFAULT_TEMPLATE);
  const starter = templateById(DEFAULT_TEMPLATE);
  const [format, setFormat] = useState<FormatId>(starter.format);
  const [length, setLength] = useState<LengthId>(starter.length);
  const [cadence, setCadence] = useState<CadenceId>(starter.cadence);

  const chosenFormat = formatById(format);
  const chosenLength = lengthById(length);
  const chosenCadence = cadenceById(cadence);
  const chosenTemplate = templateById(templateId);
  const offeredCadences = cadencesFor(length);

  const recipeMatch = useMemo(
    () => matchingTemplate(format, length, cadence),
    [format, length, cadence]
  );

  function applyTemplate(id: TemplateId) {
    const template = templateById(id);
    setTemplateId(id);
    setFormat(template.format);
    setLength(template.length);
    setCadence(template.cadence);
  }

  function changeLength(next: LengthId) {
    setLength(next);
    const allowed = cadencesFor(next);
    if (!allowed.includes(cadence)) {
      setCadence(suggestedCadence(next));
      return;
    }
    /*
      A year of "any day" is allowed, and it is also the one people land on
      by changing the length after mixing a week. Nudge to the window that
      makes a long contest a game rather than a lock-in. They can tap Any
      day again if that is what they meant.
    */
    if ((next === "quarter" || next === "year") && cadence === "always") {
      setCadence(suggestedCadence(next));
    }
  }

  const shortRecipes = TEMPLATES.filter((entry) => templateHorizon(entry) === "short");
  const longRecipes = TEMPLATES.filter((entry) => templateHorizon(entry) === "long");
  const usualFormats = FORMATS.filter((entry) => !isPartyFormat(entry.id));
  const partyFormats = FORMATS.filter((entry) => isPartyFormat(entry.id));

  return (
    <Panel
      title="Start a battle"
      description="A second contest beside the ordinary week. Pick a recipe, or mix a rule book, a length and when anybody may buy. Everybody in this league is in it, everybody starts level, and nothing about it touches your record."
    >
      <form action={formAction} className="flex flex-col gap-5">
        <input type="hidden" name="leagueId" value={leagueId} />
        <input type="hidden" name="format" value={format} />
        <input type="hidden" name="length" value={length} />
        <input type="hidden" name="cadence" value={cadence} />

        <Segmented
          label="How to choose the battle"
          options={[
            { value: "recipe", label: "A recipe" },
            { value: "custom", label: "Mix your own" },
          ]}
          value={mode}
          onValueChange={(next) => {
            setMode(next);
            if (next === "recipe") applyTemplate(recipeMatch ?? templateId);
          }}
        />

        {mode === "recipe" ? (
          <div className="flex flex-col gap-4">
            <span id="battle-recipe-label" className="text-sm leading-none font-medium">
              The game
            </span>
            <div role="radiogroup" aria-labelledby="battle-recipe-label" className="flex flex-col gap-4">
              <RecipeGroup label="A week or less" templates={shortRecipes} selected={templateId} onPick={applyTemplate} />
              <RecipeGroup label="A month or more" templates={longRecipes} selected={templateId} onPick={applyTemplate} />
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-4">
              <span id="battle-format-label" className="text-sm leading-none font-medium">
                The rule book
              </span>
              <div role="radiogroup" aria-labelledby="battle-format-label" className="flex flex-col gap-4">
                <FormatGroup label="The usual books" formats={usualFormats} selected={format} onPick={setFormat} />
                <FormatGroup label="The rest" formats={partyFormats} selected={format} onPick={setFormat} />
              </div>
            </div>

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
                onValueChange={changeLength}
              />
            </div>

            <div className="flex flex-col gap-2">
              <span id="battle-cadence-label" className="text-sm leading-none font-medium">
                When you may buy
              </span>
              <Segmented
                label="When buying is allowed"
                options={CADENCES.filter((entry) => offeredCadences.includes(entry.id)).map(
                  (entry) => ({
                    value: entry.id,
                    label: entry.short,
                  })
                )}
                value={cadence}
                onValueChange={setCadence}
              />
              <p className="text-sm text-muted-foreground">
                Selling is allowed whenever this contest is running. A window
                never traps you in a name.
              </p>
            </div>
          </>
        )}

        <Well className="flex flex-col gap-1 py-3">
          {mode === "recipe" ? (
            <>
              <p className="text-sm">
                <span className="font-medium">{chosenTemplate.name}.</span>{" "}
                {chosenTemplate.tagline}
              </p>
              <p className="text-sm text-muted-foreground">
                {chosenFormat.rule} {chosenLength.name}. Measured against{" "}
                <span className="figure text-foreground">{chosenFormat.benchmark}</span>
                {chosenCadence.id === "always" ? "." : `. ${chosenCadence.rule}`}
              </p>
            </>
          ) : (
            <>
              <p className="text-sm">
                <span className="font-medium">{chosenFormat.name}.</span> {chosenFormat.rule}
              </p>
              <p className="text-sm text-muted-foreground">
                {chosenLength.name}. Measured against{" "}
                <span className="figure text-foreground">{chosenFormat.benchmark}</span>.{" "}
                {chosenLength.tagline} {chosenCadence.rule}
                {chosenFormat.tradingHours === "always"
                  ? " This one runs through the weekend."
                  : ""}
                {recipeMatch ? " That combination is also a recipe." : ""}
              </p>
            </>
          )}
        </Well>

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
            onClick={() =>
              track("battle_started", {
                format,
                length,
                cadence,
                template: mode === "recipe" ? templateId : "custom",
              })
            }
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

function RecipeGroup({
  label,
  templates,
  selected,
  onPick,
}: {
  label: string;
  templates: readonly (typeof TEMPLATES)[number][];
  selected: TemplateId;
  onPick: (id: TemplateId) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {templates.map((entry) => (
          <Tile
            key={entry.id}
            active={entry.id === selected}
            icon={entry.icon}
            name={entry.name}
            onClick={() => onPick(entry.id)}
          />
        ))}
      </div>
    </div>
  );
}

function FormatGroup({
  label,
  formats,
  selected,
  onPick,
}: {
  label: string;
  formats: readonly { id: FormatId; name: string; icon: string }[];
  selected: FormatId;
  onPick: (id: FormatId) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {formats.map((entry) => (
          <Tile
            key={entry.id}
            active={entry.id === selected}
            icon={entry.icon}
            name={entry.name}
            onClick={() => onPick(entry.id)}
          />
        ))}
      </div>
    </div>
  );
}

function Tile({
  active,
  icon,
  name,
  onClick,
}: {
  active: boolean;
  icon: string;
  name: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={cn(
        "flex min-h-14 items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-colors",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        active ? "border-primary bg-primary/10" : "border-border hover:bg-foreground/5"
      )}
    >
      <span className="shrink-0 text-lg leading-none" aria-hidden="true">
        {icon}
      </span>
      <span className="min-w-0 text-sm leading-tight font-medium">{name}</span>
    </button>
  );
}