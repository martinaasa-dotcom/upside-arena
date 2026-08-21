import Link from "next/link";
import { ArenaWordmark } from "@/components/brand/ArenaWordmark";
import { PAGE, PAGE_FRAME } from "@/lib/page-shell";
import { COMPANY_DETAILS_PENDING } from "@/lib/company";

/** Shared frame for the terms and privacy documents. */
export function LegalPage({
  title,
  version,
  children,
}: {
  title: string;
  version: string;
  children: React.ReactNode;
}) {
  return (
    <div className={PAGE_FRAME}>
      <main id="main" className={`${PAGE} py-12`}>
        <div className="mx-auto w-full max-w-2xl">
          <Link href="/" className="inline-block">
            <ArenaWordmark className="mb-10" />
            <span className="sr-only">Upside Arena home</span>
          </Link>

          <h1>{title}</h1>

          {COMPANY_DETAILS_PENDING ? (
            <p
              role="status"
              className="mt-4 rounded-lg border-l-4 border-warning bg-transparent py-2 pl-4 text-sm text-warning"
            >
              Draft. The company details in this document have not been filled
              in yet, so it is not ready to publish. See src/lib/company.ts.
            </p>
          ) : null}
          <p className="figure mt-2 text-sm text-muted-foreground">
            Version {version}
          </p>

          <div
            className="mt-8 flex flex-col gap-6 text-sm leading-relaxed text-muted-foreground
              [&_h2]:mt-4 [&_h2]:text-lg [&_h2]:text-foreground
              [&_li]:ml-5 [&_li]:list-disc [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-2
              [&_a]:text-foreground [&_a]:underline [&_a]:underline-offset-4"
          >
            {children}
          </div>

          <p className="mt-12 text-sm text-muted-foreground">
            Not financial advice. Questions:{" "}
            <a
              href="mailto:app.support@upthink.ee"
              className="text-foreground underline underline-offset-4"
            >
              app.support@upthink.ee
            </a>
            .
          </p>
        </div>
      </main>
    </div>
  );
}
