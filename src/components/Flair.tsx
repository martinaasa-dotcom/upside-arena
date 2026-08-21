import { cn } from "@/lib/utils";

/*
  A ring around somebody's picture.

  Every ring is drawn from colours the brand already has: the warm accent, the
  aqua of the mark, and plain white at low opacity. The catalogue hands over a
  key rather than a colour precisely so that a new row cannot introduce a
  second palette, which the brand doc forbids outright.

  An unknown key draws nothing rather than guessing. A cosmetic that renders
  wrongly is worse than one that does not render.
*/

const RINGS: Record<string, string> = {
  hairline: "ring-2 ring-foreground/25",
  gold: "ring-2 ring-primary",
  aqua: "ring-2 ring-[#4fd0e0]",
  // Warm on one side, cool on the other, which is the mark and the chrome
  // side by side.
  split:
    "ring-2 ring-transparent [background:linear-gradient(var(--card),var(--card))_padding-box,linear-gradient(135deg,var(--primary),#2a9fb5)_border-box] border-2 border-transparent",
  first_week: "ring-2 ring-primary/70",
  member: "ring-2 ring-primary ring-offset-2 ring-offset-background",
};

export function flairRing(styleKey: string | null | undefined) {
  if (!styleKey) return "";
  return RINGS[styleKey] ?? "";
}

/** The ring on its own, for previewing one in the shop. */
export function FlairSwatch({ styleKey }: { styleKey: string | null }) {
  return (
    <span
      aria-hidden="true"
      className={cn("block size-8 shrink-0 rounded-full bg-muted", flairRing(styleKey))}
    />
  );
}
