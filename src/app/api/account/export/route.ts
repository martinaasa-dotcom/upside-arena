import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";

/*
  Everything Arena holds about the signed-in account, as one JSON file.
  RLS already limits each query to the caller's own rows, so this cannot
  return another player's data even if a filter were dropped.
*/
export async function GET() {
  // No project configured means no session, so this is a refusal, not an error.
  if (!isSupabaseConfigured) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const [
    { data: profile },
    { data: acceptances },
    { data: portfolios },
    { data: trades },
    { data: holdings },
    { data: memberships },
    { data: streak },
    { data: titles },
    { data: notificationSettings },
    { data: notifications },
    { data: shareCards },
    { data: devices },
  ] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase.from("terms_acceptances").select("*").eq("user_id", user.id),
    supabase.from("portfolios").select("*").eq("user_id", user.id),
    /*
      Trades and holdings hang off a portfolio rather than off a person, so
      they are filtered through it. Row level security already limits both to
      the caller's own rows; the filter is what makes the query legal, not
      what makes it safe.
    */
    supabase.from("trades").select("*, portfolios!inner(user_id)").eq("portfolios.user_id", user.id),
    supabase
      .from("holdings")
      .select("*, portfolios!inner(user_id)")
      .eq("portfolios.user_id", user.id),
    supabase.from("league_members").select("*").eq("user_id", user.id),
    supabase.from("streaks").select("*").eq("user_id", user.id).maybeSingle(),
    supabase.from("user_rewards").select("*").eq("user_id", user.id),
    supabase
      .from("notification_settings")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase.from("notifications").select("*").eq("user_id", user.id),
    supabase.from("share_cards").select("*").eq("user_id", user.id),
    /*
      Which browsers are subscribed, without the encryption keys. Those keys
      are what lets a message be sent to the device, so putting them in a file
      somebody downloads would turn an export into a way of pushing to their
      phone. Everything else about the subscription is here.
    */
    supabase
      .from("push_subscriptions")
      .select("id, user_agent, created_at, last_used_at")
      .eq("user_id", user.id),
  ]);

  const payload = {
    exported_at: new Date().toISOString(),
    account: {
      id: user.id,
      email: user.email,
      created_at: user.created_at,
      last_sign_in_at: user.last_sign_in_at,
      sign_in_providers: user.app_metadata?.providers ?? [],
    },
    profile: profile ?? null,
    terms_acceptances: acceptances ?? [],
    portfolios: portfolios ?? [],
    trades: trades ?? [],
    holdings: holdings ?? [],
    league_memberships: memberships ?? [],
    streak: streak ?? null,
    titles_earned: titles ?? [],
    notification_settings: notificationSettings ?? null,
    notifications_sent: notifications ?? [],
    shared_weeks: shareCards ?? [],
    subscribed_devices: devices ?? [],
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "content-type": "application/json",
      "content-disposition": 'attachment; filename="upside-arena-data.json"',
      "cache-control": "no-store",
    },
  });
}
