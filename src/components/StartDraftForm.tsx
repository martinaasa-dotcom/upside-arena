"use client";

import { useActionState, useState } from "react";
import { ListOrdered } from "lucide-react";
import { Panel, Well } from "@/components/Panel";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/Segmented";
import { cn } from "@/lib/utils";
import { track } from "@/lib/analytics";
import { type FormatId } from "@/lib/game/formats";
import { LENGTHS, type LengthId } from "@/lib/game/lengths";
import {
  DEFAULT_PICK_SECONDS,
  DEFAULT_ROUNDS,
  DRAFTABLE_FORMATS,
  MIN_SEATS,
  PICK_SECONDS_CHOICES,
  ROUND_CHOICES,
  boardFor,
  pickClockLabel,
} from "@/lib/game/draft-order";
import {
  submitOpenDraft,
  type DraftFormState,
} from "@/app/(app)/leagues/draft-actions";

/*
  Opening a draft night.

  The same two choices a battle asks for, plus two that are about the evening
  rather than about the contest: how many names each, and how long a turn
  lasts. Both are on this screen rather than buried, because they are what
  somebody is deciding when they say "shall we do this after dinner" -- three
  names each at a minute a turn is twenty minutes for a room of five, and five
  names each at two minutes is the better part of an hour.

  Only the rule books with a board on them are offered. A draft needs a list
  everybody can see that runs out as it is picked over, and "any company or
  fund" is not a list, it is a search box. DRAFTABLE_FORMATS derives that
  rather than naming names, so a format added with a hand-picked list is
  draftable the day it lands.
*/
export function StartDraftForm({ leagueId }: { leagueId: string }) {
  const [state, formAction, pending] = useActionState<DraftFormState, FormData>(
    submitOpenDraft,
    {}
  );
  const [format, setFormat] = useState<FormatId>(
    DRAFTABLE_FORMATS[0]?.id ?? "silicon"
  );
  const [length, setLength] = useState<LengthId>("week");
  const [rounds, setRounds] = useState(DEFAULT_ROUNDS);
  const [pickSeconds, setPickSeconds] = useState<number>(DEFAULT_PICK_SECONDS);

  const chosen = DRAFTABLE_FORMATS.find((entry) => entry.id === format);
  const chosenLength = LENGTHS.find((entry) => entry.id === length) ?? LENGTHS[1];
  const board = chosen ? (boardFor(chosen) ?? []) : [];

  /*
    How big a room this shape of draft will hold, said before anybody joins.

    A league of eight choosing five names each off a board of twenty-four is
    a draft that cannot finish, and finding that out when the last person taps
    Start, after everybody has gathered, is the worst possible moment. So the
    board size and the rounds are turned into a number of people here.
  */
  const roomFor = rounds > 0 ? Math.floor(board.length / rounds) : 0;

  return (
    <Panel
      title="Draft night"
      description="Pick in turn, off one board, with your friends in the room or on a call. A name somebody takes is gone for everybody else, and what you draft is what you hold."
    >
      <form action={formAction} className="flex flex-col gap-5">
        <input type="hidden" name="leagueId" value={leagueId} />
        <input type="hidden" name="format" value={format} />
        <input type="hidden" name="length" value={length} />
        <input type="hidden" name="rounds" value={rounds} />
        <input type="hidden" name="pickSeconds" value={pickSeconds} />

        <div className="flex flex-col gap-2">
          <span id="draft-format-label" className="text-sm leading-none font-medium">
            The board
          </span>
          <div
            role="radiogroup"
            aria-labelledby="draft-format-label"
            className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4"
          >
            {DRAFTABLE_FORMATS.map((entry) => {
              const active = entry.id === format;
              const size = boardFor(entry)?.length ?? 0;
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
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground"
                  )}
                >
                  <span className="text-lg leading-none" aria-hidden="true">
                    {entry.icon}
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-medium">{entry.name}</span>
                    <span className="font-mono text-xs tabular-nums text-muted-foreground">
                      {size} names
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {chosen ? (
          <Well className="flex flex-col gap-1.5">
            <p className="text-sm">
              <span className="font-medium">{chosen.name}.</span> {chosen.rule}
            </p>
            <p className="text-sm text-muted-foreground">
              Measured against {chosen.benchmark}.
              {chosen.tradingHours === "always"
                ? " This one runs through the weekend."
                : ""}
            </p>
          </Well>
        ) : null}

        <div className="flex flex-col gap-2">
          <span id="draft-rounds-label" className="text-sm leading-none font-medium">
            Names each
          </span>
          <Segmented
            label="How many names each person drafts"
            options={ROUND_CHOICES.map((count) => ({
              value: String(count),
              label: String(count),
            }))}
            value={String(rounds)}
            onValueChange={(value) => setRounds(Number(value))}
          />
          <p className="text-sm text-muted-foreground">
            Everybody&rsquo;s picks are the same size, so this is the whole of
            what you are deciding: which names, never how much of them.{" "}
            {roomFor >= MIN_SEATS ? (
              <>
                This board holds{" "}
                <span className="text-foreground">up to {roomFor} people</span> at{" "}
                {rounds} each.
              </>
            ) : (
              <span className="text-loss">
                This board is too small for {rounds} names each.
              </span>
            )}
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <span id="draft-clock-label" className="text-sm leading-none font-medium">
            The clock
          </span>
          <Segmented
            label="How long a turn lasts"
            options={PICK_SECONDS_CHOICES.map((seconds) => ({
              value: String(seconds),
              label: seconds < 60 ? `${seconds}s` : `${seconds / 60} min`,
            }))}
            value={String(pickSeconds)}
            onValueChange={(value) => setPickSeconds(Number(value))}
          />
          <p className="text-sm text-muted-foreground">
            {pickClockLabel(pickSeconds)}. A turn nobody takes is taken for them
            off the top of the board, so one person walking off does not stop
            the evening.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <span id="draft-length-label" className="text-sm leading-none font-medium">
            How long it runs
          </span>
          <Segmented
            label="How long the contest runs after the draft"
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
            disabled={pending || roomFor < MIN_SEATS}
            onClick={() => track("draft_opened", { format, length, rounds })}
          >
            <ListOrdered className="size-4" aria-hidden="true" />
            {pending ? "Opening" : "Open the room"}
          </Button>
          <p className="text-sm text-muted-foreground">
            Everybody joins, then you start it. Nothing is bought until Monday
            opens.
          </p>
        </div>
      </form>
    </Panel>
  );
}
