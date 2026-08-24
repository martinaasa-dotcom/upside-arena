"use client";

import { Button } from "@/components/ui/button";
import { ConfirmAction } from "@/components/ConfirmAction";
import { Badge } from "@/components/ui/badge";
import { removeAddress } from "@/app/(app)/profile/address-actions";
import { connectGoogle } from "@/app/auth/actions";
import type { LinkedAddress } from "@/lib/auth/linked-emails";
import { track } from "@/lib/analytics";

/*
  Every way into one account, on one screen.

  A person has one Arena account and one player tag, and often more than one
  mailbox: the address they signed up with on a laptop, and the Google account
  their phone is signed in to. Without this they make a second account, which
  is a second player tag, a second record and a league nobody is in.

  One way to add one, because Google is the only way into an account. The
  handshake proves the mailbox, so the address is joined on the spot and can
  sign in straight away.

  There were two. The other took any address and mailed it a confirmation
  link, joining nothing until somebody opened it. It went with the magic link:
  an address you cannot sign in with is not worth confirming, and confirming
  one anyway is a way to promise somebody a way in that does not exist.
*/

function GoogleGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true" focusable="false">
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.5a4.7 4.7 0 0 1-2 3.1l3.2 2.5c1.9-1.7 3-4.3 3-7.3 0-.7-.1-1.4-.2-2z"
      />
      <path
        fill="#34A853"
        d="M12 22c2.7 0 5-.9 6.7-2.3l-3.2-2.5c-.9.6-2 1-3.5 1a6 6 0 0 1-5.7-4.1l-3.3 2.6A10 10 0 0 0 12 22z"
      />
      <path fill="#FBBC05" d="M6.3 14.1a6 6 0 0 1 0-3.8L3 7.7a10 10 0 0 0 0 8.6z" />
      <path
        fill="#4285F4"
        d="M12 6.1c1.5 0 2.8.5 3.8 1.5l2.8-2.8A10 10 0 0 0 3 7.7l3.3 2.6A6 6 0 0 1 12 6.1z"
      />
    </svg>
  );
}

const ROW = "glass-well flex min-h-14 flex-wrap items-center gap-x-3 gap-y-2 rounded-lg px-4 py-2";

export function SignInAddresses({
  primaryEmail,
  addresses,
  googleEnabled,
  notice,
}: {
  primaryEmail: string;
  addresses: LinkedAddress[];
  googleEnabled: boolean;
  notice?: string;
}) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <div className={ROW}>
          <span className="figure min-w-0 flex-1 truncate text-sm">{primaryEmail}</span>
          <Badge variant="outline">Main</Badge>
        </div>

        {addresses.map((address) => (
          <div key={address.id} className={ROW}>
            <span className="figure min-w-0 flex-1 truncate text-sm">{address.email}</span>

            {/*
              Always. The Google handshake writes the address down already
              verified, so there is no longer any such thing as one waiting on
              a mailbox. The column stays, because the row still records when
              it was proved.
            */}
            <Badge variant="outline">Signs in</Badge>

            <ConfirmAction
              action={removeAddress}
              fields={{ id: address.id }}
              label="Remove"
              variant="ghost"
              title={`Stop ${address.email} signing you in?`}
              description="Tapping Continue with Google from that account would open a new, empty Arena account instead of this one. You can connect it again at any time."
              confirmLabel="Remove it"
              cancelLabel="Keep it"
            />
          </div>
        ))}
      </div>

      {notice ? (
        <p role="status" className="text-sm text-muted-foreground">
          {notice}
        </p>
      ) : null}

      {googleEnabled ? (
        <form action={connectGoogle}>
          <Button
            type="submit"
            variant="outline"
            className="gap-2.5"
            onClick={() => track("address_google_started")}
          >
            <GoogleGlyph />
            Connect a Google account
          </Button>
        </form>
      ) : null}

    </div>
  );
}
