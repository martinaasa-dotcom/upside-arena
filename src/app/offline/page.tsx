import { ArenaWordmark } from "@/components/brand/ArenaWordmark";
import { Panel } from "@/components/Panel";
import { PAGE, PAGE_FRAME } from "@/lib/page-shell";

export const metadata = { title: "No connection" };

export default function OfflinePage() {
  return (
    <div className={PAGE_FRAME}>
      <main id="main" className={`${PAGE} flex min-h-dvh flex-col justify-center py-16`}>
        <div className="mx-auto w-full max-w-md">
          <ArenaWordmark className="mb-8" />
          <Panel
            title="You are offline"
            description="Arena needs a connection to show live prices and standings. It will pick up where you left off once you are back."
          />
        </div>
      </main>
    </div>
  );
}
