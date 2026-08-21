"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Well } from "@/components/Panel";
import { track } from "@/lib/analytics";

/*
  The invite code, and one button that puts a ready-made message on the
  clipboard. Asking someone to retype eight characters into a chat is where an
  invite gets abandoned.
*/
export function InviteCode({ code, leagueName }: { code: string; leagueName: string }) {
  const [copied, setCopied] = useState(false);

  const share = `Join my league "${leagueName}" on Upside Arena. Use code ${code} at https://upsidearena.com/leagues`;

  return (
    <Well className="flex flex-wrap items-center justify-between gap-3">
      <span className="flex flex-col gap-0.5">
        <span className="text-sm text-muted-foreground">Invite code</span>
        <span className="figure text-lg font-semibold tracking-widest">{code}</span>
      </span>

      <Button
        variant="outline"
        size="sm"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(share);
            setCopied(true);
            // The last step Arena controls before an invite either works or
            // is abandoned in somebody's chat app.
            track("league_invite_copied");
            window.setTimeout(() => setCopied(false), 2500);
          } catch {
            // Clipboard access can be refused. The code is on screen either
            // way, so there is nothing to recover from.
          }
        }}
      >
        {copied ? <Check /> : <Copy />}
        {copied ? "Copied" : "Copy invite"}
      </Button>
    </Well>
  );
}
