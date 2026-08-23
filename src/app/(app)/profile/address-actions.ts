"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { playerChanged } from "@/lib/game/cache";

/*
  Removing one of the other addresses that reach an account.

  Adding used to live here too, as a request rather than a change: it mailed a
  confirmation link to the address and joined nothing until that link was
  opened. It went with the magic link, because Google is the only way into an
  account now and an address you cannot sign in with is not worth confirming.
  Adding is `connectGoogle` in src/app/auth/actions.ts: the same handshake, so
  the proof that somebody can read the mailbox is Google's rather than ours.

  Removing stays immediate, because taking away a way in should never wait on
  a mailbox somebody may have lost access to, which is one of the reasons a
  person removes an address in the first place.
*/

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
