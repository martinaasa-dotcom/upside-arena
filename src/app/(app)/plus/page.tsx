import { Check, Coins } from "lucide-react";
import { Panel, Well } from "@/components/Panel";
import { Badge } from "@/components/ui/badge";
import { PlusControls } from "@/components/PlusControls";
import { CoinShop } from "@/components/CoinShop";
import { TrackView } from "@/components/TrackView";
import { getSession } from "@/lib/profile";
import { getStanding, FREE_STANDING } from "@/lib/billing/entitlements";
import { getRewards } from "@/lib/game/streaks";
import { COIN_BUNDLES, COIN_TERMS, PLUS_BENEFITS } from "@/lib/billing/plan";
import { cadencesOnSale, stripeConfigured } from "@/lib/billing/stripe";
import { PAGE, STACK } from "@/lib/page-shell";
import { formatDate } from "@/lib/format";

/*
  Arena Plus, and the coin shop.

  One rule governs this whole screen, and it is written on the screen itself:
  money never touches a score. Everything sold here is a cosmetic or a
  convenience, every price is fixed and visible before anything is pressed,
  and there is no bundle whose contents are decided by chance.

  Cancelling is one button away and goes straight to the payment provider's
  own portal. There is no path anywhere in Arena that asks somebody to email
  us to stop paying.
*/

export const metadata = { title: "Arena Plus" };
export const dynamic = "force-dynamic";

export default async function PlusPage() {
  const { user } = await getSession();

  const [standing, rewards] = await Promise.all([
    user ? getStanding(user.id) : Promise.resolve(FREE_STANDING),
    user
      ? getRewards(user.id)
      : Promise.resolve({ owned: [], locked: [], forSale: [], equipped: null }),
  ]);

  const onSale = rewards.forSale.filter((item) => !item.plusOnly);
  const memberOnly = rewards.forSale.filter((item) => item.plusOnly);

  return (
    <div className={`${PAGE} ${STACK}`}>
      <TrackView event="plus_viewed" properties={{ member: standing.hasPlus }} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1>Arena Plus</h1>
        {standing.hasPlus ? <Badge>Member</Badge> : null}
      </div>

      <Panel>
        <p className="text-sm">
          The whole game is free and always will be: portfolios, leagues,
          streaks, standings, no adverts.{" "}
          <span className="text-muted-foreground">
            Nothing on this page changes a score, a starting balance, a ranking
            or what you can trade. It buys decoration and convenience, and that
            is the whole of it.
          </span>
        </p>
      </Panel>

      {!stripeConfigured ? (
        <Panel
          title="Not on sale yet"
          description="Arena Plus and coins are built but not switched on. Nothing here can be bought today, and the free game is unaffected."
        />
      ) : null}

      <Panel
        title={standing.hasPlus ? "Your membership" : "What Arena Plus gives you"}
        description={
          standing.hasPlus
            ? undefined
            : "A subscription, cancellable at any time in one tap."
        }
      >
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-3">
            {PLUS_BENEFITS.map((benefit) => (
              <Well key={benefit.title} className="flex items-start gap-3 py-3">
                <Check
                  className="mt-0.5 size-4 shrink-0 text-primary"
                  aria-hidden="true"
                />
                <span className="flex min-w-0 flex-col">
                  <span className="text-sm font-medium">{benefit.title}</span>
                  <span className="text-sm text-muted-foreground">
                    {benefit.detail}
                  </span>
                </span>
              </Well>
            ))}
          </div>

          <PlusControls
            status={standing.status}
            hasPlus={standing.hasPlus}
            until={standing.until ? formatDate(standing.until) : null}
            cadences={cadencesOnSale()}
            canManage={stripeConfigured && standing.hasPlus}
          />
        </div>
      </Panel>

      <Panel
        title="Coins"
        description="You earn coins by turning up: every streak milestone pays some, and the longer ones hand over something to wear. Buying them is the shortcut. Every bundle is a fixed number of coins for a fixed price, and you see what you are getting before you pay."
        action={
          <span className="figure flex items-center gap-2 text-lg font-semibold">
            <Coins className="size-4 text-primary" aria-hidden="true" />
            {standing.coins}
          </span>
        }
      >
        <CoinShop
          bundles={COIN_BUNDLES}
          onSale={onSale}
          memberOnly={memberOnly}
          balance={standing.coins}
          hasPlus={standing.hasPlus}
          canBuy={stripeConfigured}
        />
      </Panel>

      <Panel title="The small print">
        <ul className="flex list-disc flex-col gap-2 pl-5 text-sm text-muted-foreground">
          <li>{COIN_TERMS}</li>
          <li>
            Arena Plus renews automatically until you stop it. The price and how
            often you are charged are shown before you pay, and again on your
            receipt.
          </li>
          <li>
            Cancel any time, in one tap, from the button above. It takes effect
            at the end of the period you have already paid for, and you keep
            everything until then.
          </li>
          <li>
            Nothing bought here affects scoring, ranking, odds or what you can
            trade. It never will.
          </li>
        </ul>
      </Panel>
    </div>
  );
}
