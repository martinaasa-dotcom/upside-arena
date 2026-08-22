"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { placeTrade } from "@/lib/game/portfolio";
import { grantReward } from "@/lib/game/streaks";
import { searchSymbols, type SymbolMatch } from "@/lib/market/quotes";
import { formatMoney } from "@/lib/format";

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
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  }

  // The price is never taken from the form. The server reads it.
  const result = await placeTrade(user.id, parsed.data);

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

  // Cents, because this is the price they were filled at rather than a total.
  const money = formatMoney(result.price, "USD", 2);

  return {
    success:
      result.side === "buy"
        ? `Bought ${result.quantity} ${result.symbol} at ${money}.`
        : `Sold ${result.quantity} ${result.symbol} at ${money}.`,
  };
}

/** Company search for the trade screen. */
export async function lookupSymbols(query: string): Promise<SymbolMatch[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Search hits an outside service, so it stays behind sign-in.
  if (!user) return [];

  return searchSymbols(query);
}
