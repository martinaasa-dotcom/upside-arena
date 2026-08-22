import Link from "next/link";
import { Panel } from "@/components/Panel";
import { Button } from "@/components/ui/button";
import { PAGE, STACK } from "@/lib/page-shell";

export const metadata = { title: "Not found" };

/*
  Reached by a league id that is not yours or is not a league, and by anything
  else under the dock that does not exist.

  Deliberately the same answer for both. Telling a stranger that a league
  exists but is not theirs is telling them it exists.
*/
export default function AppNotFound() {
  return (
    <div className={`${PAGE} ${STACK}`}>
      <Panel
        title="There is nothing here"
        description="This page does not exist, or it is not yours to see."
        action={
          <Button asChild size="sm">
            <Link href="/home">Back to Home</Link>
          </Button>
        }
      />
    </div>
  );
}
