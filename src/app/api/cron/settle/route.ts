import { NextResponse, type NextRequest } from "next/server";
import { settleDueCycles } from "@/lib/game/settle";

/*
  An outside nudge to settle a finished week.

  Not load bearing. The app settles a due week by itself on the first request
  that touches the game, so this only makes it prompt on a quiet weekend when
  nobody has visited. Scoring is idempotent, so calling it a hundred times is
  the same as calling it once.
*/

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorised(request: NextRequest) {
  const secret = process.env.CRON_SECRET;

  // With no secret set, the endpoint is closed rather than open. An unset
  // variable must never be the thing that makes something public.
  if (!secret) return false;

  const header = request.headers.get("authorization") ?? "";
  const provided = header.startsWith("Bearer ") ? header.slice(7) : "";

  // Compare every character, so the time taken cannot reveal the secret.
  if (provided.length !== secret.length) return false;
  let diff = 0;
  for (let i = 0; i < secret.length; i++) {
    diff |= provided.charCodeAt(i) ^ secret.charCodeAt(i);
  }
  return diff === 0;
}

export async function GET(request: NextRequest) {
  if (!authorised(request)) {
    return NextResponse.json({ error: "Not authorised" }, { status: 401 });
  }

  const results = await settleDueCycles();

  return NextResponse.json(
    {
      settled: results.filter((r) => r.status === "settled").length,
      results,
    },
    { headers: { "cache-control": "no-store" } }
  );
}
