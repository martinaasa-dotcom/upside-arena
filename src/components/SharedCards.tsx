"use client";

import { useState, useTransition } from "react";
import { ExternalLink, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Well } from "@/components/Panel";
import { unshareCard } from "@/app/(app)/share-actions";
import { weekLabel } from "@/lib/share/card";
import { formatPercent } from "@/lib/format";

/*
  Every week this player has made public, and one tap to make it private
  again.

  A share link is a public URL and stays wherever it was posted, so being able
  to see the full list of them and end any of them is not a nicety. Somebody
  who cannot find what they made public has no way of taking it back.
*/

export type SharedCardSummary = {
  id: string;
  url: string;
  monday: string;
  returnPercent: number;
};

export function SharedCards({ cards }: { cards: SharedCardSummary[] }) {
  const [live, setLive] = useState(cards);
  const [busy, startTransition] = useTransition();

  function takeDown(id: string) {
    startTransition(async () => {
      const result = await unshareCard(id);
      if (!result.ok) {
        toast.error("We could not take it down. Try again.");
        return;
      }
      setLive((current) => current.filter((card) => card.id !== id));
      toast.success("Taken down. That link no longer works.");
    });
  }

  if (live.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        You have not shared a week. When you do, the link will be listed here so
        you can take it down again.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {live.map((card) => (
        <Well key={card.id} className="flex flex-wrap items-center gap-3 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm">
              Week of {weekLabel(card.monday)}
              <span
                className={`figure ml-2 ${
                  card.returnPercent >= 0 ? "text-gain" : "text-loss"
                }`}
              >
                {formatPercent(card.returnPercent)}
              </span>
            </p>
            <p className="truncate text-xs text-muted-foreground">{card.url}</p>
          </div>

          <Button size="sm" variant="outline" asChild>
            <a href={card.url} target="_blank" rel="noreferrer">
              <ExternalLink className="size-4" aria-hidden="true" />
              See it
            </a>
          </Button>

          <Button
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={() => takeDown(card.id)}
          >
            <X className="size-4" aria-hidden="true" />
            Take it down
          </Button>
        </Well>
      ))}
    </div>
  );
}
