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
    <>
      {/*
        The landing is the only page that sends somebody to Google. A named
        hint on the root layout would open a connection on every signed-in
        room. Chrome honours X-DNS-Prefetch-Control as permission; Safari
        ignores that header and only prefetches hosts named in a link.
        `preconnect` is the tap. `dns-prefetch` is what older WebKit takes.
        Next hoists both into the document head from a server page.
      */}
      <link rel="preconnect" href="https://accounts.google.com" />
      <link rel="dns-prefetch" href="https://accounts.google.com" />
      {/*
        `landing-field` splits the field: the first screen reuses the room's
        two lamps, dithered and boxed to one viewport, and the rest of the
        page carries three more lobes with no SVG filter. Safari tiles a
        document-tall filter, so both halves of the hero have to live in a
        layer that fits in one tile.
      */}
      <div className={`${PAGE_FRAME} landing-field`}>
        {/*
          Counted once for the page rather than once per button. The card is
          rendered twice, at the top and at the end, and a card reporting its
          own views would count one visitor as two.
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
    </>
  );
}
