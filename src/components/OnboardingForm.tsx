"use client";

import { useActionState, useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Panel } from "@/components/Panel";
import { completeOnboarding, type OnboardingState } from "@/app/onboarding/actions";
import { MINIMUM_AGE } from "@/lib/legal";
import { track } from "@/lib/analytics";

export function OnboardingForm({
  defaultName,
  defaultHandle,
  alreadyConfirmedAge,
}: {
  defaultName: string;
  defaultHandle: string;
  alreadyConfirmedAge: boolean;
}) {
  const [state, formAction, pending] = useActionState<OnboardingState, FormData>(
    completeOnboarding,
    {}
  );
  const [ageConfirmed, setAgeConfirmed] = useState(alreadyConfirmedAge);
  const nameId = useId();
  const handleId = useId();
  const ageId = useId();

  useEffect(() => {
    track("onboarding_viewed");
  }, []);

  return (
    <Panel>
      <form action={formAction} className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={nameId}>Your name</Label>
          <Input
            id={nameId}
            name="displayName"
            defaultValue={defaultName}
            maxLength={40}
            autoComplete="nickname"
            required
            aria-describedby={`${nameId}-hint`}
          />
          <p id={`${nameId}-hint`} className="text-sm text-muted-foreground">
            A first name or a nickname is fine.
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={handleId}>Your player tag</Label>
          <Input
            id={handleId}
            name="handle"
            defaultValue={defaultHandle}
            maxLength={20}
            pattern="[a-zA-Z0-9_]{3,20}"
            autoComplete="username"
            required
            aria-describedby={`${handleId}-hint`}
          />
          <p id={`${handleId}-hint`} className="text-sm text-muted-foreground">
            Letters, numbers and underscores. Everyone gets a different one.
          </p>
        </div>

        {!alreadyConfirmedAge ? (
          <div className="flex items-center gap-2">
            <Checkbox
              id={ageId}
              name="ageConfirmed"
              checked={ageConfirmed}
              onCheckedChange={(value) => setAgeConfirmed(value === true)}
            />
            <Label htmlFor={ageId} className="text-sm font-normal text-muted-foreground">
              I am {MINIMUM_AGE} or older.
            </Label>
          </div>
        ) : (
          <input type="hidden" name="ageConfirmed" value="on" />
        )}


        {state.error ? (
          <p role="alert" className="text-sm text-loss">
            {state.error}
          </p>
        ) : null}

        <Button type="submit" disabled={pending || !ageConfirmed} size="lg">
          {pending ? "Saving" : "Start playing"}
        </Button>
      </form>
    </Panel>
  );
}
