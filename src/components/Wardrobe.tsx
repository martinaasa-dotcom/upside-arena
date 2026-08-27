import { Lock } from "lucide-react";
import { Well } from "@/components/Panel";
import { Button } from "@/components/ui/button";
import { FlairSwatch } from "@/components/Flair";
import { cn } from "@/lib/utils";
import { submitEquip } from "@/app/(app)/profile/cosmetic-actions";
import { SETTING_ACTIONS, SETTING_COPY, SETTING_ROW, SettingBar } from "@/components/ui/setting-row";
import type { LockedReward, OwnedReward, Wardrobe as W } from "@/lib/game/streaks";
import type { CosmeticSlot } from "@/lib/supabase/database.types";

/*
  Everything somebody owns, in the three slots section 2.5 names: a title next
  to your name, a ring around your picture, and how your own screens are lit.
  Pod badges are the fourth, and they wait for pods.

  Decoration and nothing else. None of it changes a score, and the bought ones
  say plainly that they were bought, because a purchase that looks earned
  devalues the earned ones.
*/

const SLOTS: { slot: CosmeticSlot; title: string; description: string }[] = [
  {
    slot: "title",
    title: "Titles",
    description: "Sits next to your name where other players can see it.",
  },
  {
    slot: "flair",
    title: "Picture rings",
    description: "Goes around your picture.",
  },
  {
    slot: "theme",
    title: "How your screens are lit",
    description: "Only you see this one. It changes nothing anybody else sees.",
  },
];

function Preview({ item }: { item: { kind: CosmeticSlot; styleKey: string | null } }) {
  if (item.kind !== "flair") return null;
  return <FlairSwatch styleKey={item.styleKey} />;
}

function Slot({
  slot,
  title,
  description,
  owned,
  locked,
  equipped,
}: {
  slot: CosmeticSlot;
  title: string;
  description: string;
  owned: OwnedReward[];
  locked: LockedReward[];
  equipped: string | null;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      {owned.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nothing here yet. These come from playing, or from the shop.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {owned.map((item) => (
            <form key={item.id} action={submitEquip}>
              <input type="hidden" name="slot" value={slot} />
              <input
                type="hidden"
                name="rewardId"
                value={item.equipped ? "" : item.id}
              />
              <button
                type="submit"
                className={cn(
                  "glass-well flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left transition-colors",
                  SETTING_ROW,
                  "hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                  item.equipped && "ring-1 ring-primary/40"
                )}
              >
                <Preview item={item} />
                <span className={`flex flex-col ${SETTING_COPY}`}>
                  <span className="truncate text-sm font-medium">{item.name}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {item.description}
                  </span>
                </span>
                <span className={SETTING_ACTIONS}>
                  <span className="text-xs text-primary">
                    {item.equipped ? "Wearing" : "Wear"}
                  </span>
                </span>
              </button>
            </form>
          ))}
        </div>
      )}

      {equipped ? (
        <form action={submitEquip}>
          <input type="hidden" name="slot" value={slot} />
          <input type="hidden" name="rewardId" value="" />
          <SettingBar
            action={
              <Button type="submit" variant="ghost" size="sm">
                Wear none
              </Button>
            }
          />
        </form>
      ) : null}

      {locked.length > 0 ? (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-muted-foreground">Still to earn</p>
          {locked.map((item) => (
            <Well key={item.id} className={`${SETTING_ROW} py-2.5 opacity-70`}>
              <Lock
                className="size-4 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
              <span className={`flex flex-col ${SETTING_COPY}`}>
                <span className="truncate text-sm">{item.name}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {item.description}
                </span>
              </span>
            </Well>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function Wardrobe({ wardrobe }: { wardrobe: W }) {
  return (
    <div className="flex flex-col gap-8">
      {SLOTS.map((s) => (
        <Slot
          key={s.slot}
          slot={s.slot}
          title={s.title}
          description={s.description}
          owned={wardrobe.owned.filter((r) => r.kind === s.slot)}
          locked={wardrobe.locked.filter((r) => r.kind === s.slot)}
          equipped={wardrobe.equipped[s.slot]}
        />
      ))}
    </div>
  );
}
