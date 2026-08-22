# Email, and keeping it deliverable

Arena sends two kinds of mail, from two different places, and only one of them
is a problem when it goes wrong.

| What | Sent by | To whom |
|---|---|---|
| The sign-in link | Supabase Auth | Anybody who types an address into the sign-in form |
| The weekly notification fallback | Resend, from `src/lib/notify/send.ts` | Players who asked for it, at the address on their account |

The sign-in link is the one that matters here. It goes to an address nobody
has verified yet, because verifying it is exactly what the link is for. Every
typo, every placeholder, every address somebody made up to see what the app
does is a message sent to a mailbox that does not exist, and every one of those
comes back as a bounce against the project's sending reputation.

## Why this is worth caring about

Supabase writes when a project's bounce rate gets high, and the letter says
plainly what happens next: sending privileges get restricted. That does not
degrade sign-in, it removes it. Nobody new can get in, and nobody signed out
can get back in, including every player whose address was spelled perfectly.

So bounces are not a deliverability nicety here. They are the single failure
that can take the front door off the product.

## What the app does about it

Three checks stand in front of `signInWithOtp`, in `src/app/auth/actions.ts`.
All three run before any message is asked for, because the cheapest bounce is
the one that was never sent.

**1. The address has to be shaped like an address.**
`src/lib/auth/email-address.ts` reads it strictly: one `@`, a local part a
mailbox could actually have, a domain of real labels, and an alphabetic ending.
It also tidies first — whitespace, `mailto:`, angle brackets, a trailing dot
and the zero-width characters that ride along with a copy from a web page are
all things somebody meant to leave out.

**2. Names that can never receive are refused outright.**
The RFC 2606 and 6761 reserved names — `example.com`, anything under `.test`,
`.invalid`, `.local`, `.localhost` — exist so as never to resolve, and they
turn up in real sign-in fields constantly because that is what a placeholder
teaches people to type. So do send-only mailboxes like `noreply@`. Both are a
guaranteed bounce and both now get a sentence instead of a message.

**3. A domain one edit from a very common one gets a question.**
`gmial.com`, `hotmial.com`, `gmail.con`, `outlok.com`. The person is asked
"did you mean" and their own spelling stays on offer next to the suggestion.
Nothing is corrected silently: real domains do sit one letter from famous ones,
and quietly sending somebody's sign-in link to a stranger's mailbox would be a
worse bug than the one being fixed.

**4. And then the domain system is asked whether there is anywhere to deliver.**
`src/lib/auth/email-mx.ts` looks for a mail exchanger, and for the address
record that makes a host its own exchanger. A domain with neither will bounce
without exception, so that is refused too.

That check fails open, deliberately and in every direction. A timeout, a
refused resolver, a server failure, an edge runtime with no resolver at all:
every one of those lets the sign-in through. Only the domain system saying
"there is no such name" turns anybody away. Locking players out over a slow DNS
server would be a far worse fault than the bounce being prevented.

The same syntax rules guard the notification fallback in
`src/lib/notify/send.ts`, where nobody can be asked about a bad address because
it came from an account rather than a form. An account created before these
checks existed would otherwise be mailed every week for ever, bouncing every
time.

## The dashboard half, which cannot be done in code

### Auth email is on Resend — done, 2026-08-22

Supabase's built-in email service is shared infrastructure with a small hourly
allowance, and its reputation is shared with every other project using it.
Arena already has a Resend account and a verified domain for the notification
fallback, so pointing auth at the same place means one sender, one reputation
and metrics that actually name the bounces.

Recorded here so the settings can be checked without hunting for them. In
**Supabase, Project Settings, Authentication, SMTP Settings**, *Enable Custom
SMTP* is on:

| Field | Value |
|---|---|
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | a Resend API key with sending access |
| Sender email | the same verified address as `RESEND_FROM` |
| Sender name | `Upside Arena` |

The API key is a separate one from the notification key, named `supabase-auth`,
so either can be revoked without taking the other down.

The sender address has to be on a domain verified in Resend. An unverified one
does not bounce, it fails outright, which is worse: nobody can sign in at all.

**Confirm it worked.** Request a sign-in link, then look in Resend's **Emails**
list. The message should be there. If it is not, Supabase is still sending it
itself and the settings did not save.

### Set the rate limits alongside it

*Minimum interval per user* is set to 60 seconds, on the same screen. Somebody
pressing the button four times does not need four links, and four links to a
dead address is four bounces rather than one.

*Emails per hour* is the one still worth a decision. Turning custom SMTP on
raises it to 30 an hour, which is fine for a quiet week and is not a launch
day: thirty people signing in inside an hour is not an unusual afternoon, and
the thirty-first is simply refused. **Authentication, Rate Limits** is where to
raise it, and it should be set to what a real day needs and no more.

### Watch the number

Resend's dashboard shows bounces per day once auth mail goes through it. A
bounce rate above about 2% is worth looking into; above 5% is what generates
the letter from Supabase. If it climbs after all of the above, the cause is
almost always a real address that has since been closed, and the fix is to stop
mailing it: those come from the notification fallback, not from sign-in.

## Testing without mailing strangers

`supabase start` runs a local mail server on
[127.0.0.1:54324](http://127.0.0.1:54324) and every message the local project
sends lands there and goes nowhere else. That is the place to test sign-in.

Never test against a live address that is not your own, and never against a
made-up one: a made-up address on a real domain is a real bounce, and it is
charged to the project exactly like a stranger's would be.
