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
    profileResult,
    acceptancesResult,
    portfoliosResult,
    tradesResult,
    holdingsResult,
    membershipsResult,
    streakResult,
    titlesResult,
    notificationSettingsResult,
    notificationsResult,
    shareCardsResult,
    entitlementsResult,
    coinsResult,
    devicesResult,
    addressesResult,
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
    supabase.from("entitlements").select("*").eq("user_id", user.id),
    supabase.from("coin_ledger").select("*").eq("user_id", user.id),
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
    /*
      The other addresses that open this account, without the digest of a
      pending confirmation. That digest is the only thing standing between a
      copy of this file and somebody claiming an address, and it is of no use
      to the person who asked what we hold on them.
    */
    supabase
      .from("account_emails")
      .select("id, email, verified_at, created_at")
      .eq("user_id", user.id),
  ]);

  /*
    Every one of those used to be read for its rows and asked nothing about
    whether the read worked. A query that failed came back as null, became an
    empty list in the file, and the person who asked what we hold on them was
    handed a document saying we hold nothing of that kind. There is no way to
    tell that apart from the truth by looking at it, which is what makes it
    worse than a refusal: somebody could check their export, see no trades,
    and be wrong about their own record with our file as the evidence.

    So a section that could not be read stops the whole export. Retrying costs
    a click. A quietly incomplete answer to this particular question does not
    get a second look.
  */
  const sections = {
    profile: profileResult,
    terms_acceptances: acceptancesResult,
    portfolios: portfoliosResult,
    trades: tradesResult,
    holdings: holdingsResult,
    league_memberships: membershipsResult,
    streak: streakResult,
    titles_earned: titlesResult,
    notification_settings: notificationSettingsResult,
    notifications_sent: notificationsResult,
    shared_weeks: shareCardsResult,
    what_you_have_bought: entitlementsResult,
    coin_history: coinsResult,
    subscribed_devices: devicesResult,
    other_sign_in_addresses: addressesResult,
  };

  const unread = Object.entries(sections)
    .filter(([, result]) => result.error)
    .map(([name]) => name);

  if (unread.length > 0) {
    console.error("account export incomplete", { userId: user.id, unread });
    return NextResponse.json(
      {
        error:
          "We could not read all of your data, so we have not sent a partial file. Try again in a moment.",
        sections_unread: unread,
      },
      { status: 503, headers: { "cache-control": "no-store" } }
    );
  }

  const payload = {
    exported_at: new Date().toISOString(),
    account: {
      id: user.id,
      email: user.email,
      created_at: user.created_at,
      last_sign_in_at: user.last_sign_in_at,
      sign_in_providers: user.app_metadata?.providers ?? [],
    },
    profile: profileResult.data ?? null,
    terms_acceptances: acceptancesResult.data ?? [],
    portfolios: portfoliosResult.data ?? [],
    trades: tradesResult.data ?? [],
    holdings: holdingsResult.data ?? [],
    league_memberships: membershipsResult.data ?? [],
    streak: streakResult.data ?? null,
    titles_earned: titlesResult.data ?? [],
    notification_settings: notificationSettingsResult.data ?? null,
    notifications_sent: notificationsResult.data ?? [],
    shared_weeks: shareCardsResult.data ?? [],
    what_you_have_bought: entitlementsResult.data ?? [],
    coin_history: coinsResult.data ?? [],
    subscribed_devices: devicesResult.data ?? [],
    other_sign_in_addresses: addressesResult.data ?? [],
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "content-type": "application/json",
      "content-disposition": 'attachment; filename="upside-arena-data.json"',
      "cache-control": "no-store",
    },
  });
}
