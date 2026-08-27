"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { PlayCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { replayTour } from "@/app/(app)/actions";

/*
  Asking for the walkthrough again.

  It plays over whatever room you are on, so this puts the version number back
  to zero and refreshes -- the layout's gate does the rest, exactly as it does
  for somebody seeing it for the first time. Finishing it writes the current
  version back, so this is not a switch anybody can get stuck in.
*/
export function ReplayTour() {
  const [pending, start] = useTransition();
  const router = useRouter();

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      aria-label={pending ? "Opening the tour" : "Show me around again"}
      onClick={() =>
        start(async () => {
          const { ok } = await replayTour();
          if (!ok) {
            toast.error("We could not open that. Try again in a moment.");
            return;
          }
          router.refresh();
        })
      }
    >
      <PlayCircle className="size-4" aria-hidden="true" />
      {pending ? "Opening" : "Show me"}
    </Button>
  );
}
