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
import { SettingBar } from "@/components/ui/setting-row";
import { deleteAccount } from "@/app/(app)/profile/actions";
import { track } from "@/lib/analytics";

const CONFIRM_WORD = "delete";

export function AccountControls() {
  const [confirmation, setConfirmation] = useState("");
  const [pending, startTransition] = useTransition();
  const [exporting, setExporting] = useState(false);

  /*
    Fetched rather than linked, so a refusal can be read before it is saved.

    The export refuses rather than serving a file it could not fill, and a
    plain <a download> saves whatever comes back — which meant a failure
    arrived as a file named after their data with an error inside it. Somebody
    asking what we hold on them should be told we could not answer, not handed
    a document to interpret.
  */
  async function exportData() {
    setExporting(true);
    try {
      const response = await fetch("/api/account/export");

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        toast.error(
          body?.error ?? "We could not put your file together. Try again in a moment."
        );
        return;
      }

      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = "upside-arena-data.json";
      link.click();
      URL.revokeObjectURL(url);

      track("account_data_exported");
    } catch {
      toast.error("We could not put your file together. Try again in a moment.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <SettingBar
        action={
          <Button
            variant="outline"
            size="sm"
            onClick={exportData}
            disabled={exporting}
          >
            <Download />
            {exporting ? "Putting it together" : "Download"}
          </Button>
        }
        description="A single file with your profile and what you have agreed to."
      >
        <span className="block truncate text-sm font-medium">Download my data</span>
      </SettingBar>

      <SettingBar
        action={
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm">
                <Trash2 />
                Close
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
        }
        description="This cannot be undone."
      >
        <span className="block truncate text-sm font-medium">Close my account</span>
      </SettingBar>
    </div>
  );
}
