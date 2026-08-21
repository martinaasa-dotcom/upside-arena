"use client";

import { useState, useTransition } from "react";
import { Check, Copy, Download, Share2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Well } from "@/components/Panel";
import { track } from "@/lib/analytics";
import { shareMyWeek, unshareCard } from "@/app/(app)/share-actions";

/*
  Handing somebody their week in a form they can post.

  Three routes out, in order of how good they are. A phone offers the real
  share sheet, which is where this actually travels. A desktop browser gets
  the text on the clipboard, which is the same thing one step slower. And the
  picture is a plain link to a PNG, because a link is the one way of handing
  over a file that works everywhere.

  The text matters more than the picture. It survives a chat that strips
  formatting, an app that never expands a link, and a screenshot of a
  screenshot, and it is what carried Wordle.
*/

type Shared = { url: string; text: string; cardId: string };

export function ShareWeek({ label = "Share this week" }: { label?: string }) {
  const [shared, setShared] = useState<Shared | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, startTransition] = useTransition();

  function make(then: (result: Shared) => void) {
    startTransition(async () => {
      track("share_started");
      const result = await shareMyWeek();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      const next = { url: result.url, text: result.text, cardId: result.cardId };
      setShared(next);
      then(next);
    });
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      track("share_copied");
      toast.success("Copied. Paste it anywhere.");
    } catch {
      // A browser that refuses the clipboard still leaves the text on screen
      // to select by hand, so this is a nudge rather than an error.
      toast("Select the text and copy it.");
    }
  }

  function share() {
    make(async (result) => {
      /*
        The share sheet takes the text and the link together. The link is left
        in the text as well as passed separately, because some apps take one
        and drop the other, and a card with no link cannot be followed.
      */
      if (typeof navigator !== "undefined" && navigator.share) {
        try {
          await navigator.share({
            title: "My week in Upside Arena",
            text: result.text,
          });
          // The share sheet does not say where it went, only that it opened
          // and was not dismissed. That is the honest ceiling here.
          track("share_completed", { via: "sheet" });
          return;
        } catch {
          // Dismissing the sheet lands here too, which is not a failure. The
          // panel below stays open either way.
          return;
        }
      }

      await copy(result.text);
    });
  }

  function takeBack() {
    if (!shared) return;
    const cardId = shared.cardId;

    startTransition(async () => {
      const result = await unshareCard(cardId);
      if (!result.ok) {
        toast.error("We could not take it down. Try again.");
        return;
      }
      setShared(null);
      track("share_revoked", { from: "recap" });
      toast.success("Taken down. That link no longer works.");
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" disabled={busy} onClick={share}>
          <Share2 className="size-4" aria-hidden="true" />
          {label}
        </Button>

        {shared ? (
          <>
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => copy(shared.text)}
            >
              {copied ? (
                <Check className="size-4" aria-hidden="true" />
              ) : (
                <Copy className="size-4" aria-hidden="true" />
              )}
              {copied ? "Copied" : "Copy"}
            </Button>

            <Button size="sm" variant="outline" asChild>
              <a
                href={`${new URL(shared.url).pathname}/opengraph-image`}
                target="_blank"
                rel="noreferrer"
                onClick={() => track("share_image_opened")}
              >
                <Download className="size-4" aria-hidden="true" />
                Picture
              </a>
            </Button>

            <Button size="sm" variant="ghost" disabled={busy} onClick={takeBack}>
              <X className="size-4" aria-hidden="true" />
              Take it down
            </Button>
          </>
        ) : null}
      </div>

      {shared ? (
        <Well className="flex flex-col gap-2 py-3">
          <pre className="figure overflow-x-auto text-xs leading-relaxed whitespace-pre-wrap text-muted-foreground">
            {shared.text}
          </pre>
          <p className="text-xs text-muted-foreground">
            Anyone with this link can see this week, and nothing else about you.
            Taking it down makes the link stop working.
          </p>
        </Well>
      ) : null}
    </div>
  );
}
