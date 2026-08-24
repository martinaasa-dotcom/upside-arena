import { NextResponse, type NextRequest } from "next/server";
import { userFromUnsubscribe } from "@/lib/notify/unsubscribe";
import { saveNotificationSettings } from "@/lib/notify/settings";

/*
  The end of the emails, from inside one.

  Two methods, and the difference between them is the whole design.

  POST turns them off. That is what a mail client does by itself when it sees
  List-Unsubscribe-Post, and what the form below does when a person presses
  the button. It is also the only method that changes anything.

  GET shows that button. It cannot turn anything off, and the reason is that a
  GET is not a decision: mail scanners, link previewers and corporate security
  gateways all fetch every URL in a message before anybody reads it, and an
  unsubscribe that fires on a fetch is an unsubscribe that happens to people
  who never asked.

  It is on the public list, because somebody who has stopped using Arena has
  no session and that is precisely the person this is for. What makes that
  safe is that the URL carries a signature of whose mail it is, and the only
  thing the signature permits is turning that person's email off.
*/

export const maxDuration = 10;

function who(request: NextRequest): string | null {
  return userFromUnsubscribe(
    request.nextUrl.searchParams.get("u"),
    request.nextUrl.searchParams.get("s")
  );
}

/*
  The form's target, rebuilt from the two parameters that mean anything rather
  than echoed back.

  `request.nextUrl.search` is whatever was in the address bar, and only `u`
  and `s` of it are ever checked. Writing the rest of it back into the page
  would put a stranger's text inside our own HTML on our own origin, which is
  a cross-site scripting hole with a valid signature attached to it. So the
  action is built from the two values, encoded, and nothing else survives.
*/
function actionFor(userId: string, signature: string): string {
  const params = new URLSearchParams({ u: userId, s: signature });
  return `/api/unsubscribe?${params.toString()}`;
}

/** Plain, self-contained and tiny: this is read in a browser tab with no app around it. */
function page(title: string, body: string, action?: string): NextResponse {
  const form = action
    ? `<form method="post" action="${action}"><button type="submit">Turn the emails off</button></form>`
    : "";

  return new NextResponse(
    `<!doctype html><html lang="en"><head><meta charset="utf-8">` +
      `<meta name="viewport" content="width=device-width,initial-scale=1">` +
      `<meta name="robots" content="noindex">` +
      `<title>${title}</title>` +
      `<style>` +
      `body{margin:0;min-height:100dvh;display:flex;align-items:center;justify-content:center;` +
      `padding:24px;background:#000;color:#fafafa;` +
      `font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}` +
      `main{max-width:28rem;width:100%}h1{font-size:1.125rem;margin:0 0 8px}` +
      `p{font-size:.875rem;line-height:1.6;color:#b5b5b5;margin:0 0 20px}` +
      `button{appearance:none;border:none;border-radius:.5rem;padding:.5rem 1rem;font:inherit;` +
      `font-size:.875rem;font-weight:500;cursor:pointer;background:#11c0d3;color:#001014}` +
      `a{color:#11c0d3}</style></head>` +
      `<body><main><h1>${title}</h1><p>${body}</p>${form}</main></body></html>`,
    { status: 200, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } }
  );
}

export async function GET(request: NextRequest) {
  const userId = who(request);

  if (!userId) {
    return page(
      "That link is not one of ours",
      "It may have been cut in half by a mail client. You can turn the emails off on your profile page instead."
    );
  }

  return page(
    "Turn Arena's emails off?",
    "You will still be able to sign in, and nothing about your weeks changes. Notifications in the browser are separate and stay as they are.",
    actionFor(userId, request.nextUrl.searchParams.get("s") ?? "")
  );
}

export async function POST(request: NextRequest) {
  const userId = who(request);

  if (!userId) {
    return page(
      "That link is not one of ours",
      "It may have been cut in half by a mail client. You can turn the emails off on your profile page instead."
    );
  }

  const saved = await saveNotificationSettings(userId, { email: false });

  if (!saved) {
    return page(
      "That did not save",
      "Nothing was changed. Try the link again in a moment, or turn the emails off on your profile page."
    );
  }

  return page(
    "Done. No more emails.",
    "Notifications in the browser are separate and are still on if you had them. You can turn either back on from your profile at any time."
  );
}
