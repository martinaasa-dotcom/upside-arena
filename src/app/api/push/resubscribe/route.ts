import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { removePushSubscription, savePushSubscription } from "@/lib/notify/settings";

/*
  A push service retiring a subscription and handing out a new one.

  The service worker reports it here. Without this, somebody who agreed once
  quietly stops receiving anything and has no way of knowing, which is worse
  than never having agreed.
*/


export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  let body: {
    old?: string | null;
    subscription?: { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const next = body.subscription;
  if (!next?.endpoint || !next.keys?.p256dh || !next.keys?.auth) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const saved = await savePushSubscription(
    user.id,
    { endpoint: next.endpoint, keys: { p256dh: next.keys.p256dh, auth: next.keys.auth } },
    request.headers.get("user-agent")
  );

  if (!saved) return NextResponse.json({ error: "Could not save" }, { status: 500 });

  // Only once the replacement is stored, so a failure here cannot leave the
  // player with neither.
  if (body.old && body.old !== next.endpoint) {
    await removePushSubscription(body.old);
  }

  return NextResponse.json({ ok: true });
}
