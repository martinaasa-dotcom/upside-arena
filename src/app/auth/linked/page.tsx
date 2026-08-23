import { Suspense } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/Panel";
import { ArenaWordmark } from "@/components/brand/ArenaWordmark";
import { PAGE, PAGE_FRAME } from "@/lib/page-shell";
import { readEmail } from "@/lib/auth/email-address";

export const metadata = { title: "Address connected" };

/*
  What somebody sees after opening the confirmation in their second mailbox.

  Signed out on purpose, and it says so in what it offers: the link may well
  have been opened on a phone that has never been signed in here, and telling
  that person to sign in first would be asking them to prove something they
  just proved.
*/
export default function AddressLinkedPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  return (
    <div className={PAGE_FRAME}>
      <main id="main" className={`${PAGE} flex min-h-dvh flex-col justify-center py-16`}>
        <div className="mx-auto w-full max-w-md">
          <ArenaWordmark className="mb-8" />
          <Suspense fallback={<Panel title="That address is connected" />}>
            <Confirmation searchParams={searchParams} />
          </Suspense>
        </div>
      </main>
    </div>
  );
}

async function Confirmation({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;

  /*
    Read back rather than trusted. Anything at all can be put in a query
    string, and a page that prints it as though Arena said it is a page
    somebody can make say anything.
  */
  const verdict = readEmail(email ?? "");
  const address = verdict.kind === "unreachable" ? null : verdict.email;

  return (
    <Panel
      title="That address is connected"
      description={
        address
          ? `${address} now opens your Arena account. Sign in with either address and you land in the same place, with the same player tag and the same record.`
          : "It now opens your Arena account. Sign in with either address and you land in the same place, with the same player tag and the same record."
      }
    >
      <Button asChild className="mt-2">
        <Link href="/home">Open Arena</Link>
      </Button>
    </Panel>
  );
}
