import { HEX } from "@/lib/brand/mark";
import { escapeHtml } from "@/lib/notify/email-template";

/*
  The two letters that joining a second address needs.

  Both carry one fact and one link, in the same voice and the same markup as
  the notification mail next door, and neither offers a way to turn it off:
  these are answers to something the person just did, not something they
  subscribed to.

  Pure, and apart from the sending, so the escaping can be tested directly.
  An address typed by a person reaches this markup.
*/

export type LinkMail = { subject: string; html: string; text: string };

function shell(title: string, body: string, action: string, url: string): string {
  const link = escapeHtml(url);

  return `<!doctype html>
<html><body style="margin:0;padding:24px;background:#000000;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table role="presentation" width="100%" style="max-width:480px;margin:0 auto;background:#171717;border-radius:10px;padding:24px;">
    <tr><td>
      <p style="margin:0 0 4px;color:#a1a1a1;font-size:13px;letter-spacing:1px;">UPSIDE ARENA</p>
      <h1 style="margin:0 0 12px;color:#fafafa;font-size:20px;font-weight:600;">${escapeHtml(title)}</h1>
      <p style="margin:0 0 20px;color:#a1a1a1;font-size:15px;line-height:1.6;">${escapeHtml(body)}</p>
      <a href="${link}" style="display:inline-block;background:${HEX.primary};color:${HEX.primaryForeground};text-decoration:none;padding:10px 18px;border-radius:999px;font-size:15px;font-weight:600;">${escapeHtml(action)}</a>
      <p style="margin:24px 0 0;color:#868686;font-size:12px;line-height:1.6;">
        The link lasts one hour and works once.<br>
        Play money only. Not financial advice.
      </p>
    </td></tr>
  </table>
</body></html>`;
}

function plain(title: string, body: string, url: string): string {
  return [
    title,
    "",
    body,
    "",
    url,
    "",
    "The link lasts one hour and works once.",
    "Play money only. Not financial advice.",
  ].join("\n");
}

/**
 * Sent to the address somebody has asked to add, from the account adding it.
 *
 * Deliberately says what happens if this was not them, because this is the one
 * letter in the app that lands in a mailbox whose owner may never have heard
 * of Arena. Ignoring it has to be a real answer, and it is: nothing is joined
 * until the link is clicked.
 */
export function confirmAddressMail(url: string, requestedBy: string | null): LinkMail {
  const title = "Confirm this address";

  /*
    The account is named by the address it signs in with, not by the name on
    the profile. A name is typed by whoever asked and can be made to say
    anything, including something that sounds like it came from us. An address
    cannot: it is the one thing about the asking account that had to be proved.
  */
  const asker = requestedBy
    ? `The Upside Arena account at ${requestedBy}`
    : "An Upside Arena account";

  const body = `${asker} asked to sign in with this address as well. Confirm it and both addresses open that same account, with the same player tag and the same record. If you were not expecting this, ignore it: nothing is joined unless the link below is opened.`;

  return {
    subject: "Confirm this address for Upside Arena",
    html: shell(title, body, "Confirm this address", url),
    text: plain(title, body, url),
  };
}

/**
 * The sign-in link itself, when somebody asks for one at an address they added
 * rather than the one the account was made with.
 *
 * Arena sends this one instead of Supabase, because the link inside it opens
 * the account the address was added to. A link sent the usual way would open a
 * new empty account with the same person's name on it, which is exactly the
 * thing this whole feature exists to stop.
 */
export function linkedSignInMail(url: string): LinkMail {
  const title = "Your sign-in link";
  const body =
    "You asked for a link to this address. It opens the Upside Arena account you added it to, with your player tag and your record on it.";

  return {
    subject: "Your Upside Arena sign-in link",
    html: shell(title, body, "Open Arena", url),
    text: plain(title, body, url),
  };
}
