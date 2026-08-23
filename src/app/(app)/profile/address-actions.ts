"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { readEmail } from "@/lib/auth/email-address";
import { domainAcceptsMail } from "@/lib/auth/email-mx";
import { startAddressLink } from "@/lib/auth/linked-emails";
import { ADDRESS_MESSAGES } from "@/lib/auth/address-link";
import { playerChanged } from "@/lib/game/cache";

/*
  Adding and removing the other addresses that reach one account.

  Adding is a request, not a change: it sends a confirmation and nothing else.
  Removing is immediate, because taking away a way in should never wait for a
  mailbox somebody may have lost access to, which is one of the reasons a
  person removes an address in the first place.
*/

export type AddressState = {
  error?: string;
  sent?: string;
  note?: string;
  /*
    A spelling worth asking about before anything is sent, and the address as
    it was typed, so the form can offer both and correct nobody by surprise.
    The sign-in form asks the same question the same way.
  */
  suggestion?: string;
  typed?: string;
};

const schema = z.object({
  email: z.string(),
  confirmed: z.string().optional(),
});

export async function addAddress(
  _prev: AddressState,
  formData: FormData
): Promise<AddressState> {
  const parsed = schema.safeParse({
    email: formData.get("email"),
    confirmed: formData.get("confirmed") ?? undefined,
  });

  if (!parsed.success) return { error: "Check the form and try again." };

  const verdict = readEmail(parsed.data.email);

  if (verdict.kind === "unreachable") {
    return { error: verdict.message, typed: verdict.email };
  }

  if (verdict.kind === "check" && parsed.data.confirmed !== "1") {
    return { suggestion: verdict.suggestion, typed: verdict.email };
  }

  const email = verdict.email;
  const domain = email.slice(email.lastIndexOf("@") + 1);

  if (!(await domainAcceptsMail(domain))) {
    return {
      error: `We could not find a mail server for ${domain}, so a link sent there would not arrive. Check the spelling.`,
      typed: email,
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/");

  const result = await startAddressLink({
    userId: user.id,
    primaryEmail: user.email ?? null,
    email,
  });

  if (result.kind === "error") return { error: ADDRESS_MESSAGES[result.code], typed: email };
  if (result.kind === "already") return { note: ADDRESS_MESSAGES.already };

  /*
    The list of addresses is cached as this player's, so clearing the page
    without dropping the tag would redraw it from the list as it was before the
    pending address was written down.
  */
  playerChanged(user.id);
  revalidatePath("/profile");

  /*
    Said before the link is opened, not after, because the account being closed
    belongs to the person reading this and they should hear about it while they
    can still decide not to.
  */
  return {
    sent: result.closes
      ? `${ADDRESS_MESSAGES.sent} Opening it also closes the empty Arena account that address made, which has never been played.`
      : ADDRESS_MESSAGES.sent,
  };
}

export async function removeAddress(formData: FormData): Promise<void> {
  const id = formData.get("id")?.toString();
  if (!id) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/");

  /*
    Through the player's own session rather than the service role, so the
    database decides whose row this is. Row level security allows exactly one
    write to this table from a client and this is it.
  */
  await supabase.from("account_emails").delete().eq("id", id);

  playerChanged(user.id);
  revalidatePath("/profile");
}
