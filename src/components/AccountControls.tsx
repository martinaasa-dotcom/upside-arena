"use client";

import { useState, useTransition } from "react";
import { Download, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { deleteAccount } from "@/app/(app)/profile/actions";
import { track } from "@/lib/analytics";

const CONFIRM_WORD = "delete";

export function AccountControls() {
  const [confirmation, setConfirmation] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-start gap-2">
        <Button asChild variant="outline" onClick={() => track("account_data_exported")}>
          <a href="/api/account/export" download>
            <Download />
            Download my data
          </a>
        </Button>
        <p className="text-sm text-muted-foreground">
          A single file with your profile and what you have agreed to.
        </p>
      </div>

      <div className="flex flex-col items-start gap-2">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive">
              <Trash2 />
              Close my account
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Close your account for good?</AlertDialogTitle>
              <AlertDialogDescription>
                Your profile, your record and your leagues are erased. We cannot
                bring them back. Download your data first if you want to keep it.
              </AlertDialogDescription>
            </AlertDialogHeader>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="confirm-delete">
                Type {CONFIRM_WORD} to confirm
              </Label>
              <Input
                id="confirm-delete"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                autoComplete="off"
              />
            </div>

            <AlertDialogFooter>
              <AlertDialogCancel>Keep my account</AlertDialogCancel>
              <AlertDialogAction
                disabled={confirmation.trim().toLowerCase() !== CONFIRM_WORD || pending}
                onClick={(event) => {
                  event.preventDefault();
                  startTransition(async () => {
                    const result = await deleteAccount();
                    if (result?.error) {
                      toast.error(result.error);
                      return;
                    }
                    track("account_deleted");
                  });
                }}
              >
                {pending ? "Closing" : "Close my account"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <p className="text-sm text-muted-foreground">
          This cannot be undone.
        </p>
      </div>
    </div>
  );
}
