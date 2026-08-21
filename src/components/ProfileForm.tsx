"use client";

import { useActionState, useEffect, useId } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateProfile, type ProfileState } from "@/app/(app)/profile/actions";
import { track } from "@/lib/analytics";

export function ProfileForm({
  defaultName,
  defaultHandle,
  email,
}: {
  defaultName: string;
  defaultHandle: string;
  email: string;
}) {
  const [state, formAction, pending] = useActionState<ProfileState, FormData>(
    updateProfile,
    {}
  );
  const nameId = useId();
  const handleId = useId();
  const emailId = useId();

  useEffect(() => {
    if (state.saved) {
      toast.success("Saved");
      track("profile_updated");
    }
  }, [state.saved]);

  return (
    <form action={formAction} className="flex max-w-md flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={nameId}>Your name</Label>
        <Input
          id={nameId}
          name="displayName"
          defaultValue={defaultName}
          maxLength={40}
          required
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={handleId}>Your player tag</Label>
        <Input
          id={handleId}
          name="handle"
          defaultValue={defaultHandle}
          maxLength={20}
          pattern="[a-zA-Z0-9_]{3,20}"
          required
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={emailId}>Email</Label>
        <Input
          id={emailId}
          value={email}
          readOnly
          className="text-muted-foreground"
        />
        <p className="text-sm text-muted-foreground">
          This is how you sign in. To change it, email app.support@upthink.ee.
        </p>
      </div>

      {state.error ? (
        <p role="alert" className="text-sm text-loss">
          {state.error}
        </p>
      ) : null}

      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
