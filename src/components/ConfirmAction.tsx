"use client";

import { useState, useTransition, type ReactNode } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

/*
  A button that asks before it does the thing.

  There are three one-click actions in Arena that take something away, and
  closing an account is the only one that ever asked. The other two were a
  plain submit: leaving a league, which on a phone is a button sitting where a
  thumb rests, and removing a sign-in address, which is how somebody's other
  Google account stops opening this one and starts opening a new empty one.

  Neither is a catastrophe and that is exactly why a typed confirmation would
  be the wrong shape here: what they need is a moment, not a ceremony. The
  account dialog still asks for the word, because that one cannot be undone.

  The confirming button calls the action itself rather than submitting a form
  inside the dialog, which is what AccountControls already does and is the
  only shape here with no question mark over it: Radix closes the dialog on
  that click, and a form unmounting in the same tick as it submits is a race
  nobody should have to reason about. `preventDefault` is what holds the
  dialog open while the server is working, because Radix skips its own close
  handler on an event that has been defaulted away.
*/
export function ConfirmAction({
  action,
  fields,
  label,
  title,
  description,
  confirmLabel,
  cancelLabel = "Never mind",
  variant = "outline",
  size = "sm",
}: {
  action: (formData: FormData) => void | Promise<void>;
  /** Hidden inputs the action needs, such as which league this is. */
  fields?: Record<string, string>;
  /** What the button on the page says. */
  label: ReactNode;
  title: string;
  description: string;
  /** What the button in the dialog says. Never "OK": it says what it does. */
  confirmLabel: string;
  cancelLabel?: string;
  variant?: "outline" | "destructive" | "ghost";
  /** Compact by default: this always sits in a setting row or a panel header. */
  size?: "default" | "sm";
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button type="button" variant={variant} size={size}>
          {label}
        </Button>
      </AlertDialogTrigger>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>{cancelLabel}</AlertDialogCancel>

          <AlertDialogAction
            disabled={pending}
            onClick={(event) => {
              // Holds the dialog open while the server is working. Radix skips
              // its own close handler once the event has been defaulted away.
              event.preventDefault();

              startTransition(async () => {
                const data = new FormData();
                for (const [name, value] of Object.entries(fields ?? {})) {
                  data.set(name, value);
                }

                try {
                  await action(data);
                } finally {
                  /*
                    Closed whatever happened. An action that navigates never
                    reaches this, because the redirect unwinds the transition;
                    one that fails would otherwise leave a dialog open with
                    both of its buttons disabled, which is a trap rather than
                    a question.
                  */
                  setOpen(false);
                }
              });
            }}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
