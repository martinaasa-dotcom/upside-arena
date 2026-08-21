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

  const [{ data: profile }, { data: acceptances }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase.from("terms_acceptances").select("*").eq("user_id", user.id),
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
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "content-type": "application/json",
      "content-disposition": 'attachment; filename="upside-arena-data.json"',
      "cache-control": "no-store",
    },
  });
}
