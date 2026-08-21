import { NextResponse, type NextRequest } from "next/server";
import { handleWebhook, stripeConfigured, verifyWebhook } from "@/lib/billing/stripe";

/*
  Stripe telling us something happened.

  Three rules, in order:

  1. Verify the signature before reading anything out of the body. An
     unverified webhook body is a request from a stranger claiming somebody
     paid, and the whole of Arena's paid tier would be free if this were
     skipped.
  2. Read the raw body, byte for byte. The signature is over exactly what was
     sent, so parsing it first and re-serialising breaks verification for
     entirely valid requests.
  3. Answer 200 to anything genuinely from Stripe, even when Arena could not
     do anything with it. A non-200 makes Stripe retry for days, and a
     permanent failure retried for days is noise that hides a real one.
*/

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  if (!stripeConfigured) {
    // Nothing is on sale, so nothing can have been paid for.
    return NextResponse.json({ error: "Not configured" }, { status: 404 });
  }

  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  let event;
  try {
    event = verifyWebhook(body, signature);
  } catch {
    // Deliberately says nothing about why. A stranger probing this should
    // learn only that it was refused.
    return NextResponse.json({ error: "Bad signature" }, { status: 400 });
  }

  try {
    const outcome = await handleWebhook(event);
    return NextResponse.json(outcome, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    console.error("stripe webhook failed", event.type, error);

    /*
      A 500 here is right: this one is worth retrying, because it means Arena
      failed rather than that the event was meaningless. Stripe will send it
      again, and the claim in the database means the retry is safe.
    */
    return NextResponse.json({ error: "Could not handle" }, { status: 500 });
  }
}
