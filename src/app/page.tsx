import { Suspense } from "react";
import { SignInCard } from "@/components/SignInCard";
import { SignedOutLanding } from "@/components/SignedOutLanding";
import { googleConfigured } from "@/lib/auth/google";
import { MINIMUM_AGE } from "@/lib/legal";
import { PAGE_FRAME } from "@/lib/page-shell";

/*
  The signed-out page, prerendered except for the one part that cannot be.

  Everything a visitor reads here is the same for everybody and is composed in
  SignedOutLanding, so the whole page arrives as HTML from a CDN. The only
  thing that depends on the request is the sign-in card, which needs the
  `next` the proxy put in the URL, the age error if there is one, and whether
  Google sign-in is configured on this deployment. So that card, and nothing
  else, waits.
*/

/*
  The one part of this page that is not the same for everybody.

  googleConfigured is called here rather than read from module scope, so what
  it reports is what this server holds now. Read at module scope it would have
  been read while the page was being built, and a credential present only at
  runtime would have hidden the button for the life of the deployment with
  nothing to say why.
*/
async function SignIn({ searchParams }: { searchParams: Search }) {
  const { next, error } = await searchParams;

  return (
    <SignInCard
      googleEnabled={googleConfigured()}
      next={next}
      initialError={
        error === "age"
          ? `You need to be ${MINIMUM_AGE} or older to play.`
          : undefined
      }
    />
  );
}

type Search = Promise<{ next?: string; error?: string }>;

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
      <SignedOutLanding
        signIn={
          /*
            The fallback is the card's own resting height, so nothing under it
            moves when the real one arrives.
          */
          <Suspense
            fallback={<div className="h-[7.5rem]" aria-hidden="true" />}
          >
            <SignIn searchParams={searchParams} />
          </Suspense>
        }
      />
    </div>
  );
}
