/*
  The email fallback's markup.

  Plain and short, in the same voice as the app. It carries one fact and one
  link, not a newsletter, and every one of them says how to stop receiving
  them.

  Pure, and separate from the code that sends, so the escaping below can be
  tested directly. A display name and a league name both reach this template,
  and both are typed by a player.
*/

import type { Message } from "@/lib/notify/message";

/** Everything that reaches the markup goes through here, without exception. */
export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function emailHtml(message: Message, origin: string, unsubscribeUrl: string) {
  const link = escapeHtml(`${origin}${message.url}`);
  const unsubscribe = escapeHtml(unsubscribeUrl);

  // Inline styles and the email hex values from the brand doc, because a mail
  // client will not load a stylesheet or understand oklch.
  return `<!doctype html>
<html><body style="margin:0;padding:24px;background:#000000;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table role="presentation" width="100%" style="max-width:480px;margin:0 auto;background:#171717;border-radius:10px;padding:24px;">
    <tr><td>
      <p style="margin:0 0 4px;color:#a1a1a1;font-size:13px;letter-spacing:1px;">UPSIDE ARENA</p>
      <h1 style="margin:0 0 12px;color:#fafafa;font-size:20px;font-weight:600;">${escapeHtml(message.title)}</h1>
      <p style="margin:0 0 20px;color:#a1a1a1;font-size:15px;line-height:1.6;">${escapeHtml(message.body)}</p>
      <a href="${link}" style="display:inline-block;background:#d4bc79;color:#0a0a0a;text-decoration:none;padding:10px 18px;border-radius:999px;font-size:15px;font-weight:600;">Open Arena</a>
      <p style="margin:24px 0 0;color:#868686;font-size:12px;line-height:1.6;">
        Play money only. Not financial advice.<br>
        <a href="${unsubscribe}" style="color:#868686;">Turn these emails off</a>
      </p>
    </td></tr>
  </table>
</body></html>`;
}

/** The same message for a client that will not render HTML. */
export function emailText(message: Message, origin: string, unsubscribeUrl: string) {
  return [
    message.title,
    "",
    message.body,
    "",
    `${origin}${message.url}`,
    "",
    "Play money only. Not financial advice.",
    `Turn these emails off: ${unsubscribeUrl}`,
  ].join("\n");
}
