"use client";

import { useActionState, useEffect, useId } from "react";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signInWithEmail, signInWithGoogle, type AuthState } from "@/app/auth/actions";
import { track } from "@/lib/analytics";

/*
  Sign-in.

  There is no age tick box. Age is asserted in the sentence under the button,
  the way Upside Lab does it, and continuing is the affirmative act. A separate
  checkbox is a thing to get past rather than a thing anyone reads, and it puts
  a disabled button in front of every new person, which is the first thing they
  see of the product.

  The confirmation is still recorded against the account, so there is evidence
  of it. It just is not a hurdle.
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

export function SignInCard({
  googleEnabled,
  next,
  initialError,
}: {
  googleEnabled: boolean;
  next?: string;
  initialError?: string;
}) {
  const [state, formAction, pending] = useActionState<AuthState, FormData>(
    signInWithEmail,
    {}
  );
  const emailId = useId();

  useEffect(() => {
    track("signin_viewed");
  }, []);

  useEffect(() => {
    if (state.sent) track("signin_link_requested");
  }, [state.sent]);

  useEffect(() => {
    if (state.suggestion) track("signin_email_questioned");
  }, [state.suggestion]);

  /*
    Only an address the server refused, which is the one that carries the
    typed value back. A rate limit or a missing key is not a bad address and
    counting it as one would hide the number this event exists to show.
  */
  useEffect(() => {
    if (state.error && state.typed) track("signin_email_refused");
  }, [state.error, state.typed]);

  const error = state.error ?? initialError;

  /*
    A domain one letter from a very common one. Both spellings are offered and
    neither is assumed: correcting somebody's own address without asking is how
    a link ends up at a stranger's mailbox, and refusing an unusual but real
    domain is how a player is locked out for good.
  */
  if (state.suggestion && state.typed) {
    return (
      <div className="flex flex-col gap-3 text-left">
        <h2 className="text-lg font-semibold tracking-tight">
          Did you mean {state.suggestion}?
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          You typed {state.typed}. We only send one link, so it is worth being
          sure before it goes.
        </p>

        <form action={formAction} className="flex flex-col gap-2 sm:flex-row">
          {next ? <input type="hidden" name="next" value={next} /> : null}
          <input type="hidden" name="confirmed" value="1" />

          <Button
            type="submit"
            name="email"
            value={state.suggestion}
            size="cta"
            disabled={pending}
          >
            <Mail />
            Send to {state.suggestion}
          </Button>
          <Button
            type="submit"
            name="email"
            value={state.typed}
            size="cta"
            variant="outline"
            disabled={pending}
          >
            No, {state.typed} is right
          </Button>
        </form>
      </div>
    );
  }

  if (state.sent) {
    return (
      <div className="flex flex-col gap-2 text-left" role="status">
        <h2 className="text-lg font-semibold tracking-tight">Check your email</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          We sent you a sign-in link. Open it on this device and you are in. The
          link works once and lasts an hour.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {googleEnabled ? (
        <form action={signInWithGoogle}>
          {next ? <input type="hidden" name="next" value={next} /> : null}
          <Button
            type="submit"
            size="cta"
            className="w-full gap-2.5 text-base md:w-auto md:min-w-[17rem]"
            onClick={() => track("signin_google_started")}
          >
            <GoogleGlyph />
            Continue with Google
          </Button>
        </form>
      ) : null}

      {googleEnabled ? (
        <div className="flex items-center gap-3 py-1" aria-hidden="true">
          <span className="h-px flex-1 bg-border" />
          <span className="text-xs text-muted-foreground">or</span>
          <span className="h-px flex-1 bg-border" />
        </div>
      ) : null}

      {/*
        Field and button on one row, so signing in is a single object rather
        than a stack of form controls.
      */}
      <form action={formAction} className="flex flex-col gap-2">
        <Label htmlFor={emailId} className="sr-only">
          Email
        </Label>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            id={emailId}
            /*
              Remounted on a refusal so the address the person typed is still
              there to be corrected. React clears an uncontrolled field when a
              form action returns, which would mean retyping it in full.
            */
            key={state.typed ?? "fresh"}
            defaultValue={state.typed}
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            placeholder="you@example.com"
            aria-invalid={Boolean(error) || undefined}
            aria-describedby={error ? "signin-error" : undefined}
            className="h-11 rounded-full px-4 sm:flex-1"
          />
          <Button
            type="submit"
            size="cta"
            variant={googleEnabled ? "outline" : "default"}
            disabled={pending}
            className="shrink-0"
          >
            <Mail />
            {pending ? "Sending" : "Email me a link"}
          </Button>
        </div>
      </form>

      {error ? (
        <p id="signin-error" role="alert" className="text-sm text-loss">
          {error}
        </p>
      ) : null}
    </div>
  );
}
