"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { sessionTag } from "@/lib/profile";

export type ProfileState = { error?: string; saved?: boolean };

const schema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, "Pick a name your friends will recognise.")
    .max(40, "That name is a little long. Keep it under 40 characters."),
  handle: z
    .string()
    .trim()
    .toLowerCase()
    .regex(
      /^[a-z0-9_]{3,20}$/,
      "Use 3 to 20 letters, numbers or underscores, with no spaces."
    ),
});

export async function updateProfile(
  _prev: ProfileState,
  formData: FormData
): Promise<ProfileState> {
  const parsed = schema.safeParse({
    displayName: formData.get("displayName"),
    handle: formData.get("handle"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/");

  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: parsed.data.displayName,
      handle: parsed.data.handle,
    })
    .eq("id", user.id);

  if (error) {
    if (error.code === "23505") return { error: "That name is taken. Try another." };
    return { error: "We could not save that. Try once more." };
  }

  /*
    The name is read from a cached session, so saving it has to say so or the
    player watches their old name follow them around for five minutes.

    updateTag rather than revalidateTag: this is the player looking at the
    result of their own edit, and they should see it on the very next screen
    rather than one screen later. The paths still go, because what is drawn
    from this row is not only the session.
  */
  updateTag(sessionTag(user.id));
  revalidatePath("/profile");
  revalidatePath("/home");
  return { saved: true };
}

/**
 * Closes the account and erases the rows that reference it. Privacy rules
 * require a real delete path, and it is far cheaper to build now than to
 * retrofit later.
 */
export async function deleteAccount() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/");

  const { error } = await supabase.rpc("delete_own_account");
  if (error) {
    return { error: "We could not close the account. Email app.support@upthink.ee." };
  }

  await supabase.auth.signOut();
  redirect("/");
}
