import Link from "next/link";
import { ArenaWordmark } from "@/components/brand/ArenaWordmark";
import { HEADER_BAR, HEADER_H, PAGE } from "@/lib/page-shell";

/*
  The lockup in its bar, and nothing else.

  Rooms add a name and Plus through `children`. Onboarding cannot leave for
  Home (the layout would send them straight back) so it omits `href` and
  keeps the same bar, same height, same mark.
*/
export function BrandBar({
  href,
  room,
  children,
}: {
  href?: string;
  /** Short room name, shown from `sm` the way the rooms do. */
  room?: string;
  children?: React.ReactNode;
}) {
  const lockup = (
    <>
      <ArenaWordmark uid="header" />
      {href ? <span className="sr-only">Upside Arena home</span> : null}
    </>
  );

  return (
    <header className={HEADER_BAR}>
      <div className={`${PAGE} flex ${HEADER_H} items-center gap-3`}>
        {href ? (
          <Link href={href} className="rounded-md focus-visible:outline-none">
            {lockup}
          </Link>
        ) : (
          lockup
        )}
        {room ? (
          <>
            <span className="hidden h-5 w-px bg-border sm:block" aria-hidden="true" />
            <span className="hidden text-sm text-muted-foreground sm:block">{room}</span>
          </>
        ) : null}
        {children}
      </div>
    </header>
  );
}
