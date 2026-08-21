"use client";

import { useActionState, useEffect, useId, useState } from "react";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signInWithEmail, signInWithGoogle, type AuthState } from "@/app/auth/actions";
import { MINIMUM_AGE } from "@/lib/legal";
import { track } from "@/lib/analytics";

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
      <path
        fill="#FBBC05"
        d="M6.3 14.1a6 6 0 0 1 0-3.8L3 7.7a10 10 0 0 0 0 8.6z"
      />
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
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [state, formAction, pending] = useActionState<AuthState, FormData>(
    signInWithEmail,
    {}
  );
  const ageId = useId();
  const emailId = useId();

  useEffect(() => {
    track("signin_viewed");
  }, []);

  useEffect(() => {
    if (state.sent) track("signin_link_requested");
  }, [state.sent]);

  const error = state.error ?? initialError;

  if (state.sent) {
    return (
      <div className="flex flex-col gap-3" role="status">
        <h2 className="text-lg font-semibold tracking-tight">Check your email</h2>
        <p className="text-sm text-muted-foreground">
          We sent you a sign-in link. Open it on this device and you are in. The link
          works once and lasts an hour.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/*
        The age gate gates every sign-in route on the page, so it lives outside
        both forms and is mirrored into each on submit.
      */}
      <div className="flex items-center gap-2">
        <Checkbox
          id={ageId}
          checked={ageConfirmed}
          onCheckedChange={(value) => {
            const checked = value === true;
            setAgeConfirmed(checked);
            if (!checked) track("age_gate_blocked");
          }}
          aria-describedby={error ? "signin-error" : undefined}
        />
        <Label htmlFor={ageId} className="text-sm font-normal text-muted-foreground">
          I am {MINIMUM_AGE} or older.
        </Label>
      </div>

      {googleEnabled ? (
        <form action={signInWithGoogle}>
          <input type="hidden" name="ageConfirmed" value={ageConfirmed ? "on" : ""} />
          {next ? <input type="hidden" name="next" value={next} /> : null}
          <Button
            type="submit"
            size="cta"
            className="w-full"
            disabled={!ageConfirmed}
            onClick={() => track("signin_google_started")}
          >
            <GoogleGlyph />
            Continue with Google
          </Button>
        </form>
      ) : null}

      {googleEnabled ? (
        <div className="flex items-center gap-3" aria-hidden="true">
          <span className="h-px flex-1 bg-border" />
          <span className="text-xs text-muted-foreground">or</span>
          <span className="h-px flex-1 bg-border" />
        </div>
      ) : null}

      <form action={formAction} className="flex flex-col gap-3">
        <input type="hidden" name="ageConfirmed" value={ageConfirmed ? "on" : ""} />
        {next ? <input type="hidden" name="next" value={next} /> : null}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={emailId} className="text-sm font-normal text-muted-foreground">
            Email
          </Label>
          <Input
            id={emailId}
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            placeholder="you@example.com"
            aria-invalid={Boolean(error) || undefined}
            aria-describedby={error ? "signin-error" : undefined}
          />
        </div>

        <Button
          type="submit"
          size="cta"
          variant={googleEnabled ? "outline" : "default"}
          className="w-full"
          disabled={!ageConfirmed || pending}
        >
          <Mail />
          {pending ? "Sending a link" : "Email me a sign-in link"}
        </Button>
      </form>

      {error ? (
        <p id="signin-error" role="alert" className="text-sm text-loss">
          {error}
        </p>
      ) : null}

      {!ageConfirmed ? (
        <p className="text-sm text-muted-foreground">
          Tick the box above to sign in.
        </p>
      ) : null}
    </div>
  );
}
