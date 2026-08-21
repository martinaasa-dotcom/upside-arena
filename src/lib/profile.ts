import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import type { Profile } from "@/lib/types";

/**
 * The signed-in account and its profile row. Cached per request so a layout
 * and its pages share one round trip.
 */
export const getSession = cache(async () => {
  // Without a project wired up there is no session to have. Callers redirect.
  if (!isSupabaseConfigured) return { user: null, profile: null };

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { user: null, profile: null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle<Profile>();

  return { user, profile: profile ?? null };
});

/** Onboarding is finished once a display name and the age gate are recorded. */
export function isOnboarded(profile: Profile | null) {
  return Boolean(profile?.onboarded_at && profile.display_name && profile.age_confirmed_at);
}
