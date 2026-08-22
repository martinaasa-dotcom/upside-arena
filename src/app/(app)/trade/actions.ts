"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { placeTrade } from "@/lib/game/portfolio";
import { grantReward } from "@/lib/game/streaks";
import { searchSymbols, type SymbolMatch } from "@/lib/market/quotes";
import { formatMoney } from "@/lib/format";
import { battleFormat, placeBattleTrade } from "@/lib/game/battles";
import { SHARE_TYPES } from "@/lib/game/formats";

export type TradeState = {
  error?: string;
  success?: string;
};

const schema = z.object({
  symbol: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9.\-]{1,12}$/, "Pick a company from the list."),
  side: z.enum(["buy", "sell"]),
  quantity: z.coerce
    .number()
    .int("Enter a whole number of shares.")
    .positive("Enter how many shares you want.")
    .max(1_000_000, "That is more shares than this game allows."),
  /*
    Which contest this trade is in: a league's battle, or the house week when
    it is absent.

    Named by the form rather than inferred, because the trade screen and the
    battle room are two rooms with one form between them. It is only an id:
    every rule about whether this person may trade in that contest at all is
    checked on the server against the roster, and the database checks it a
    second time.
  */
  battleId: z.string().uuid().optional(),
});

export async function submitTrade(
  _prev: TradeState,
  formData: FormData
): Promise<TradeState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/");

  const parsed = schema.safeParse({
    symbol: formData.get("symbol"),
    side: formData.get("side"),
    quantity: formData.get("quantity"),
    battleId: formData.get("battleId") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  }

  const { battleId, ...trade } = parsed.data;

  // The price is never taken from the form. The server reads it.
  const result = battleId
    ? await placeBattleTrade(user.id, battleId, trade)
    : await placeTrade(user.id, trade);

  if (!result.ok) return { error: result.error };

  /*
    Earned by playing, which is the only way anything here is earned — and
    never at the cost of the trade. The trade is already placed and paid for by
    the time this runs, so a title that will not grant must not come back as a
    failed trade. Told their money moved and their order did not, a player
    places it again.
  */
  try {
    await grantReward(user.id, "title.off_the_mark");
  } catch {
    // The next trade grants it. Nothing is lost by being late.
  }

  revalidatePath("/home");
  revalidatePath("/trade");
  if (battleId) revalidatePath("/leagues", "layout");

  // Cents, because this is the price they were filled at rather than a total.
  const money = formatMoney(result.price, "USD", 2);

  return {
    success:
      result.side === "buy"
        ? `Bought ${result.quantity} ${result.symbol} at ${money}.`
        : `Sold ${result.quantity} ${result.symbol} at ${money}.`,
  };
}

/**
 * Company search for the trade screen.
 *
 * Narrowed to what the contest being played will actually accept, so nothing
 * can be found here that would then be refused. A format that names its
 * companies one by one does not reach this at all: the screen offers the list.
 */
export async function lookupSymbols(
  query: string,
  battleId?: string
): Promise<SymbolMatch[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Search hits an outside service, so it stays behind sign-in.
  if (!user) return [];

  if (!battleId) return searchSymbols(query, SHARE_TYPES);

  /*
    The battle decides what may be searched, and reading it also establishes
    that this person is in the league. A search is a request to an outside
    service, and one that took an id from a browser without checking it would
    be a way to spend somebody else's quota by guessing.
  */
  const format = await battleFormat(user.id, battleId);
  if (!format) return [];

  // A format that names its companies does not search: the screen offers the
  // list, which is both faster and impossible to be refused by.
  if (format.universe.kind === "list") return [];

  return searchSymbols(query, format.universe.types);
}
