import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { canWriteGame, siteUrl } from "@/lib/env";
import { COMPANY } from "@/lib/company";
import { emailHtml, emailText } from "@/lib/notify/email-template";
import { isSendable } from "@/lib/auth/email-address";
import type { Message } from "@/lib/notify/message";

/*
  Getting a notification to a person.

  Two channels, and the plan is clear about why both are needed. Web push is
  materially weaker than native: on iOS it only reaches a site that has been
  added to the home screen, so a large share of players can never receive it
  at all. Email is the fallback that covers them.

  Neither channel is required for the app to work. With no keys configured
  both quietly do nothing, and the notification is still recorded as having
  had nowhere to go, so nothing is silently lost.
*/

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY ?? "";
const RESEND_KEY = process.env.RESEND_API_KEY ?? "";
const RESEND_FROM = process.env.RESEND_FROM ?? `Upside Arena <arena@upthink.ee>`;

export const pushConfigured = Boolean(VAPID_PUBLIC && VAPID_PRIVATE);
export const emailConfigured = Boolean(RESEND_KEY);

export type { Message };

type SubscriptionRow = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  failures: number;
};

/**
 * Sends to every browser a player has subscribed.
 *
 * A push service reports a dead subscription with 404 or 410. Those are
 * removed rather than retried for ever, because a browser that has been
 * cleared or uninstalled is never coming back.
 */
export async function sendPush(
  userId: string,
  message: Message
): Promise<{ delivered: number; removed: number }> {
  if (!pushConfigured || !canWriteGame) return { delivered: 0, removed: 0 };

  const admin = createAdminClient();
  const { data } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth, failures")
    .eq("user_id", userId);

  const subscriptions = (data ?? []) as SubscriptionRow[];
  if (subscriptions.length === 0) return { delivered: 0, removed: 0 };

  const webpush = (await import("web-push")).default;
  webpush.setVapidDetails(`mailto:${COMPANY.supportEmail}`, VAPID_PUBLIC, VAPID_PRIVATE);

  let delivered = 0;
  let removed = 0;

  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          JSON.stringify(message)
        );

        delivered++;
        await admin
          .from("push_subscriptions")
          .update({ last_used_at: new Date().toISOString(), failures: 0 })
          .eq("id", sub.id);
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;

        // Gone for good, not a temporary failure.
        if (status === 404 || status === 410) {
          await admin.rpc("delete_push_subscription", { p_endpoint: sub.endpoint });
          removed++;
          return;
        }

        const failures = sub.failures + 1;
        if (failures >= 5) {
          await admin.rpc("delete_push_subscription", { p_endpoint: sub.endpoint });
          removed++;
          return;
        }

        await admin.from("push_subscriptions").update({ failures }).eq("id", sub.id);
      }
    })
  );

  return { delivered, removed };
}

export async function sendEmail(
  to: string,
  message: Message
): Promise<boolean> {
  if (!emailConfigured || !to) return false;

  /*
    Addresses reach this from the account, not from a form, so nobody can be
    asked about a bad one here. Some of them predate the checks on the sign-in
    page, and an account created with a reserved or malformed address would
    otherwise be mailed every week for ever, bouncing every time and spending
    the sending reputation that everybody else's mail depends on.
  */
  if (!isSendable(to)) {
    // The domain only. An address that never got mail is still somebody's.
    const domain = to.includes("@") ? to.slice(to.lastIndexOf("@") + 1) : "no domain";
    console.error("email skipped, the address cannot receive", domain);
    return false;
  }

  const unsubscribeUrl = `${siteUrl()}/profile`;

  try {
    const { Resend } = await import("resend");
    const resend = new Resend(RESEND_KEY);

    const { error } = await resend.emails.send({
      from: RESEND_FROM,
      to,
      subject: message.title,
      html: emailHtml(message, siteUrl(), unsubscribeUrl),
      text: emailText(message, siteUrl(), unsubscribeUrl),
      headers: {
        // Lets a mail client offer one-tap unsubscribe, which is both polite
        // and what keeps mail out of a spam folder.
        "List-Unsubscribe": `<${unsubscribeUrl}>`,
      },
    });

    if (error) {
      /*
        Logged rather than swallowed. The notification is already recorded as
        having gone out, which is what stops a retry sending it twice, so a
        silent failure here would mean somebody's mail quietly disappearing
        with nothing anywhere to say why.

        The usual cause is a from address on a domain that has not been
        verified in Resend, which is a setup mistake rather than a bug, and
        one nobody can find without this line.
      */
      console.error("email refused by the provider", RESEND_FROM, error.message);
      return false;
    }

    return true;
  } catch (thrown) {
    console.error("email failed to send", thrown);
    return false;
  }
}

/**
 * A letter that answers something the person just did, rather than one they
 * subscribed to.
 *
 * Confirming a second address is the only thing that uses this so far. It
 * shares the provider and the from address with the notification mail above,
 * and shares nothing else: there is no unsubscribe on it, because there is
 * nothing to unsubscribe from. Turning these off would mean never being able
 * to confirm an address, or to sign in at one, again.
 */
export async function sendTransactionalEmail(
  to: string,
  letter: { subject: string; html: string; text: string }
): Promise<boolean> {
  if (!emailConfigured || !to) return false;

  if (!isSendable(to)) {
    const domain = to.includes("@") ? to.slice(to.lastIndexOf("@") + 1) : "no domain";
    console.error("email skipped, the address cannot receive", domain);
    return false;
  }

  try {
    const { Resend } = await import("resend");
    const resend = new Resend(RESEND_KEY);

    const { error } = await resend.emails.send({
      from: RESEND_FROM,
      to,
      subject: letter.subject,
      html: letter.html,
      text: letter.text,
    });

    if (error) {
      console.error("email refused by the provider", RESEND_FROM, error.message);
      return false;
    }

    return true;
  } catch (thrown) {
    console.error("email failed to send", thrown);
    return false;
  }
}
