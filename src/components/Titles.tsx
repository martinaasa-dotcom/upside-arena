import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Well } from "@/components/Panel";
import { cn } from "@/lib/utils";
import { submitEquipTitle } from "@/app/(app)/profile/title-actions";
import type { EarnedReward, OwnedReward } from "@/lib/game/streaks";

/*
  Titles.

  Decoration and nothing else: a title changes what sits next to your name and
  never touches a score. What is not yet earned is shown too, with what earns
  it, because a locked thing you can see is a reason to come back and a locked
  thing you cannot see is nothing at all.
*/
export function Titles({
  owned,
  locked,
  equipped,
}: {
  owned: OwnedReward[];
  locked: (EarnedReward & { streakRequired: number | null })[];
  equipped: string | null;
}) {
  return (
    <div className="flex flex-col gap-4">
      {owned.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          You have not earned a title yet. They come from showing up and from
          playing, never from paying.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {owned.map((title) => (
            <form key={title.id} action={submitEquipTitle}>
              <input
                type="hidden"
                name="rewardId"
                value={title.equipped ? "" : title.id}
              />
              <button
                type="submit"
                className={cn(
                  "glass-well flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left transition-colors",
                  "hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                  title.equipped && "ring-1 ring-primary/40"
                )}
              >
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium">{title.name}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {title.description}
                  </span>
                </span>
                <span className="shrink-0 text-xs text-primary">
                  {title.equipped ? "Wearing" : "Wear"}
                </span>
              </button>
            </form>
          ))}
        </div>
      )}

      {equipped ? (
        <form action={submitEquipTitle}>
          <input type="hidden" name="rewardId" value="" />
          <Button type="submit" variant="ghost" size="sm">
            Wear no title
          </Button>
        </form>
      ) : null}

      {locked.length > 0 ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground">Still to earn</p>
          {locked.map((title) => (
            <Well
              key={title.id}
              className="flex items-center gap-3 py-3 opacity-70"
            >
              <Lock
                className="size-4 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm">{title.name}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {title.description}
                </span>
              </span>
            </Well>
          ))}
        </div>
      ) : null}
    </div>
  );
}
