"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { track } from "@/lib/analytics";

/*
  The one button on a shared card that matters.

  Counted separately from the page view, because the gap between the two is
  the share loop's conversion rate, and that single number decides whether
  this feature is worth anything.
*/
export function ShareCta({ children }: { children: React.ReactNode }) {
  return (
    <Button asChild onClick={() => track("shared_card_cta_clicked")}>
      <Link href="/">{children}</Link>
    </Button>
  );
}
