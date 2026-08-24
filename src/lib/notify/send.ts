import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { canWriteGame, siteUrl } from "@/lib/env";
import { unsubscribeUrlFor } from "@/lib/notify/unsubscribe";
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
  message: Message,
  /*
    Whose mail this is, so the unsubscribe link in it can be theirs.

    Optional only because a caller that does not know cannot be made to
    invent one: without it the mail still goes, with the link at the foot
    pointing at the profile page as it always did. Every caller in the app
    passes it.
  */
  userId?: string
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

  /*
    A link that turns the emails off by itself, and the profile page only when
    there is no way to sign one.

    The old link went to /profile for everybody, which is behind a sign-in.
    Somebody who has stopped using Arena and wants the mail to stop does not
    sign back in to find a switch; they press the button that says spam, and
    one of those costs the sending domain more than a hundred quiet
    unsubscribes.
  */
  const signed = userId ? unsubscribeUrlFor(userId) : null;
  const unsubscribeUrl = signed ?? `${siteUrl()}/profile`;

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
        /*
          And this is what makes the offer real. Without it a client that
          shows an unsubscribe button opens the link in a browser, which is a
          sign-in page. With it, the client posts to the link itself and the
          person is done. Gmail and Yahoo have both required it of bulk
          senders since 2024.

          Only when the link is one we signed: posting to the profile page
          would do nothing at all, and a button that appears to work and does
          not is worse than no button.
        */
        ...(signed ? { "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } : {}),
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
