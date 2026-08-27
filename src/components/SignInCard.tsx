import { Button } from "@/components/ui/button";
import { signInWithGoogle } from "@/app/auth/actions";
import { TrackSubmit } from "@/components/TrackSubmit";

/*
  Sign-in, and it is one button.

  Arena used to offer a magic link as well, which meant this component was a
  form, an address field, a "did you mean gmail.com" question, a sent state,
  an error line and an MX lookup on the server behind it. All of that existed
  to get somebody's email address right, and Google already has it right.
  Removing it takes a whole class of failure out of the front door: an address
  typed one letter wrong, a link that landed in spam, a link opened on the
  wrong device, a link opened after an hour.

  There is no age tick box. Age is asserted in the sentence beside the button,
  the way Upside Lab does it, and continuing is the affirmative act. A separate
  checkbox is a thing to get past rather than a thing anyone reads, and it puts
  a disabled button in front of every new person. The durable record is the
  `terms_acceptances` row written at onboarding, which is what an account
  export returns, so nothing about the record depends on how somebody signed
  in.

  A server component. The only client piece is TrackSubmit around the form,
  which is what reports `signin_google_started`. The page renders this twice,
  at the top and at the end, and a card that counted its own views would
  count one visitor as two. `signin_viewed` belongs to the page, and is on it.
*/
export function SignInCard({
  googleEnabled,
  next,
  className,
}: {
  googleEnabled: boolean;
  next?: string;
  className?: string;
}) {
  /*
    A deployment with no Google credentials cannot sign anybody in at all.
    Saying so is better than an empty space where a button should be, and it
    matches what /auth/error says when the same thing is discovered later.
  */
  if (!googleEnabled) {
    return (
      <p className="text-sm text-muted-foreground" role="status">
        Sign-in is not connected yet.
      </p>
    );
  }

  return (
    <TrackSubmit
      action={signInWithGoogle}
      event="signin_google_started"
      className={className}
    >
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <Button
        type="submit"
        size="cta"
        className="w-full gap-2.5 text-base sm:w-auto sm:min-w-[15rem]"
      >
        <GoogleGlyph />
        Continue with Google
      </Button>
    </TrackSubmit>
  );
}

/*
  Google's mark, in Google's colours, because their brand terms require it and
  because a monochrome G on a sign-in button reads as a generic one.
*/
function GoogleGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      width={20}
      height={20}
      className="size-5"
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.5a4.7 4.7 0 0 1-2 3.1l3.2 2.5c1.9-1.7 3-4.3 3-7.3 0-.7-.1-1.4-.2-2z"
      />
      <path
        fill="#34A853"
        d="M12 22c2.7 0 5-.9 6.7-2.3l-3.2-2.5c-.9.6-2 1-3.5 1a6 6 0 0 1-5.7-4.1l-3.3 2.6A10 10 0 0 0 12 22z"
      />
      <path fill="#FBBC05" d="M6.3 14.1a6 6 0 0 1 0-3.8L3 7.7a10 10 0 0 0 0 8.6z" />
      <path
        fill="#4285F4"
        d="M12 6.1c1.5 0 2.8.5 3.8 1.5l2.8-2.8A10 10 0 0 0 3 7.7l3.3 2.6A6 6 0 0 1 12 6.1z"
      />
    </svg>
  );
}
