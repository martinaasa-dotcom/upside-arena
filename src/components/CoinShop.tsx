"use client";

import { useState, useTransition } from "react";
import { Coins, Lock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Well } from "@/components/Panel";
import { purchaseReward, startCoinPurchase } from "@/app/(app)/plus/actions";
import { formatPrice, type CoinBundle } from "@/lib/billing/plan";
import { FlairSwatch } from "@/components/Flair";
import { track } from "@/lib/analytics";
import type { ForSaleReward } from "@/lib/game/streaks";

/*
  Buying coins, and spending them.

  Every bundle says exactly how many coins for exactly how much, and every
  item says exactly what it costs, before anything is pressed. There is no
  bundle whose contents are decided by chance: that pattern is banned outright
  in some countries and is ruled out by section 3 regardless.

  Nothing here is dressed up as a bargain that expires. No countdown, no
  "limited", no strike-through price that was never charged.
*/
const GROUPS = [
  { kind: "title" as const, label: "Titles" },
  { kind: "flair" as const, label: "Picture rings" },
  { kind: "theme" as const, label: "How your screens are lit" },
];

export function CoinShop({
  bundles,
  onSale,
  memberOnly,
  balance,
  hasPlus,
  canBuy,
}: {
  bundles: CoinBundle[];
  onSale: ForSaleReward[];
  memberOnly: ForSaleReward[];
  balance: number;
  hasPlus: boolean;
  canBuy: boolean;
}) {
  const [coins, setCoins] = useState(balance);
  const [busy, startTransition] = useTransition();

  function buyBundle(id: string) {
    startTransition(async () => {
      track("coins_checkout_started", { bundle: id });
      const result = await startCoinPurchase(id);
      if (!result.ok) toast.error(result.error);
    });
  }

  function buyItem(item: ForSaleReward) {
    startTransition(async () => {
      const result = await purchaseReward(item.id);

      if (!result.ok) {
        track("cosmetic_purchase_refused");
        toast.error(result.error ?? "We could not do that. Nothing was taken.");
        return;
      }

      setCoins(result.balance ?? coins);
      track("cosmetic_purchased", { item: item.id });
      toast.success(`"${item.name}" is yours. Wear it from your profile.`);
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {onSale.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nothing is for sale at the moment.
        </p>
      ) : null}

      {GROUPS.map(({ kind, label }) => {
        const items = onSale.filter((item) => item.kind === kind);
        if (items.length === 0) return null;

        return (
          <div key={kind} className="flex flex-col gap-2">
            <p className="text-sm text-muted-foreground">{label}</p>
            {items.map((item) => {
            const affordable = item.coinPrice != null && coins >= item.coinPrice;
            return (
              <Well key={item.id} className="flex flex-wrap items-center gap-3 py-3">
                {item.kind === "flair" ? <FlairSwatch styleKey={item.styleKey} /> : null}
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium">{item.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {item.description}
                  </span>
                </span>

                <span className="figure flex shrink-0 items-center gap-1.5 text-sm">
                  <Coins className="size-3.5 text-primary" aria-hidden="true" />
                  {item.coinPrice}
                </span>

                <Button
                  size="sm"
                  variant={affordable ? "default" : "outline"}
                  disabled={busy || !affordable}
                  onClick={() => buyItem(item)}
                >
                  {affordable ? "Buy" : "Not enough"}
                </Button>
              </Well>
            );
            })}
          </div>
        );
      })}

      {memberOnly.length > 0 ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground">
            {hasPlus ? "Yours as a member" : "Only for members"}
          </p>
          {memberOnly.map((item) => (
            <Well key={item.id} className="flex items-center gap-3 py-3">
              {hasPlus ? null : (
                <Lock
                  className="size-4 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
              )}
              {item.kind === "flair" ? <FlairSwatch styleKey={item.styleKey} /> : null}
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm">{item.name}</span>
                <span className="text-xs text-muted-foreground">
                  {item.description}
                </span>
              </span>
            </Well>
          ))}
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">Buy coins</p>
        <div className="grid gap-2 xs:grid-cols-3">
          {bundles.map((entry) => (
            <Well key={entry.id} className="flex flex-col items-start gap-2 py-3">
              <span className="figure text-lg font-semibold">
                {entry.coins.toLocaleString("en-GB")}
              </span>
              <span className="text-xs text-muted-foreground">coins</span>
              <Button
                size="sm"
                variant="outline"
                disabled={busy || !canBuy}
                onClick={() => buyBundle(entry.id)}
              >
                {formatPrice(entry.amount, entry.currency)}
              </Button>
            </Well>
          ))}
        </div>
      </div>
    </div>
  );
}
