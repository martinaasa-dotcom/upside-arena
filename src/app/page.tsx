import { Suspense } from "react";
import { SignInCard } from "@/components/SignInCard";
import { SignedOutLanding } from "@/components/SignedOutLanding";
import { TrackView } from "@/components/TrackView";
import { googleConfigured } from "@/lib/auth/google";
import { PAGE_FRAME } from "@/lib/page-shell";

/*
  The signed-out page, prerendered except for the one part that cannot be.

  Everything a visitor reads here is the same for everybody and is composed in
  SignedOutLanding, so the whole page arrives as HTML from a CDN. The only
  thing that depends on the request is the sign-in button, which needs the
  `next` the proxy put in the URL and whether Google sign-in is configured on
  this deployment. So that button, and nothing else, waits.
*/

type Search = Promise<{ next?: string }>;

/*
  The one part of this page that is not the same for everybody.

  googleConfigured is called here rather than read from module scope, so what
  it reports is what this server holds now. Read at module scope it would have
  been read while the page was being built, and a credential present only at
  runtime would have hidden the button for the life of the deployment with
  nothing to say why.
*/
async function SignIn({
  searchParams,
  className,
}: {
  searchParams: Search;
  className?: string;
}) {
  const { next } = await searchParams;

  return (
    <SignInCard
      googleEnabled={googleConfigured()}
      next={next}
      className={className}
    />
  );
}

/*
  The button's own resting height, so nothing under it moves when the real one
  arrives. It is one button now, not a card with a field in it, which is why
  this is 44px rather than 120.
*/
function SignInSpace({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="h-11" aria-hidden="true" />}>
      {children}
    </Suspense>
  );
}

export default function LandingPage({
  searchParams,
}: {
  searchParams: Search;
}) {
  return (
    /*
      `landing-field` swaps the fixed pair of ambient lobes for one field as
      tall as the document. On every room in the app the fixed pair is right:
      the lobes are the room's lamps and a room is about one viewport of
      content. On a page five screens tall the light would be pinned to the
      glass, so the corner you arrived on is the same corner five screens
      later, and what reads is not a lit room but a colour that stopped.
    */
    <div className={`${PAGE_FRAME} landing-field overflow-x-clip`}>
      {/*
        Counted once for the page rather than once per button. The card is
        rendered twice, at the top and at the end, and a card reporting its own
        views would count one visitor as two.
      */}
      <TrackView event="signin_viewed" />

      <SignedOutLanding
        signIn={
          <SignInSpace>
            <SignIn searchParams={searchParams} />
          </SignInSpace>
        }
        signInAgain={
          <SignInSpace>
            <SignIn searchParams={searchParams} />
          </SignInSpace>
        }
      />
    </div>
  );
}
