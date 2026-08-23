"use client";

import { useActionState, useEffect, useId } from "react";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  addAddress,
  removeAddress,
  type AddressState,
} from "@/app/(app)/profile/address-actions";
import { connectGoogle } from "@/app/auth/actions";
import type { LinkedAddress } from "@/lib/auth/linked-emails";
import { track } from "@/lib/analytics";

/*
  Every way into one account, on one screen.

  A person has one Arena account and one player tag, and often more than one
  mailbox: the address they signed up with on a laptop, and the Google account
  their phone is signed in to. Without this they make a second account, which
  is a second player tag, a second record and a league nobody is in.

  Two ways to add one, because the two mailboxes people actually have arrive
  differently. A Google account proves itself in the handshake and is added on
  the spot. Anything else is sent a link, and nothing is joined until somebody
  opens it.
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
  const [state, formAction, pending] = useActionState<AddressState, FormData>(
    addAddress,
    {}
  );
  const fieldId = useId();

  useEffect(() => {
    if (state.sent) track("address_link_requested");
  }, [state.sent]);

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

            {address.verified ? (
              <Badge variant="outline">Signs in</Badge>
            ) : (
              <Badge variant="warning">Waiting</Badge>
            )}

            <form action={removeAddress}>
              <input type="hidden" name="id" value={address.id} />
              <Button type="submit" variant="ghost" size="sm">
                Remove
              </Button>
            </form>
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

      {/*
        The same "did you mean" question the sign-in form asks, for the same
        reason: one letter out and the link goes to somebody else's mailbox,
        and plenty of real domains sit one letter from a famous one.
      */}
      {state.suggestion && state.typed ? (
        <form action={formAction} className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground">
            You typed {state.typed}. Did you mean {state.suggestion}?
          </p>
          <input type="hidden" name="confirmed" value="1" />
          <div className="flex flex-wrap gap-2">
            <Button type="submit" name="email" value={state.suggestion} disabled={pending}>
              <Mail />
              Send to {state.suggestion}
            </Button>
            <Button
              type="submit"
              name="email"
              value={state.typed}
              variant="outline"
              disabled={pending}
            >
              No, {state.typed} is right
            </Button>
          </div>
        </form>
      ) : (
        <form action={formAction} className="flex max-w-md flex-col gap-2">
          <Label htmlFor={fieldId}>Add another address</Label>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              id={fieldId}
              /*
                Remounted on a refusal so the typed address is still there to be
                corrected. React clears an uncontrolled field when a form action
                returns, which would mean typing the whole thing again.
              */
              key={state.typed ?? "fresh"}
              defaultValue={state.typed}
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              required
              placeholder="you@gmail.com"
              aria-invalid={Boolean(state.error) || undefined}
              aria-describedby={state.error ? "address-error" : undefined}
              className="sm:flex-1"
            />
            <Button type="submit" variant="outline" disabled={pending} className="shrink-0">
              {pending ? "Sending" : "Send a link"}
            </Button>
          </div>
        </form>
      )}

      {state.error ? (
        <p id="address-error" role="alert" className="text-sm text-loss">
          {state.error}
        </p>
      ) : null}

      {state.note ? (
        <p role="status" className="text-sm text-muted-foreground">
          {state.note}
        </p>
      ) : null}

      {state.sent ? (
        <p role="status" className="text-sm text-muted-foreground">
          {state.sent}
        </p>
      ) : null}
    </div>
  );
}
