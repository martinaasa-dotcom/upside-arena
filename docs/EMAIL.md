# Email, and keeping it deliverable

Arena sends one kind of mail.

| What | Sent by | To whom |
|---|---|---|
| The notification fallback | Resend, from `src/lib/notify/send.ts` | A player who asked to be told about something, at the address on their account, when push reached no browser |

It used to send four. What went, and when:

- **The sign-in link**, sent by Supabase Auth to anybody who typed an address
  into the sign-in form. Gone with the magic link on 2026-08-23. Google is the
  only way into an account, and an ID token needs no mailbox.
- **A sign-in link at a second address**, sent by Arena rather than by
  Supabase because Supabase had never heard of that address. Gone the same
  day, with `signInWithEmail`, its only caller.
- **Confirming a second address.** Gone with the flow it belonged to: an
  address you cannot sign in with is not worth confirming, and a second Google
  account proves itself in the handshake. `link-mail.ts` and
  `sendTransactionalEmail` went with it.

**Supabase Auth now sends nothing at all.** `magicTokenFor` still mints a
one-time token so a linked address opens the account it was added to, but the
Google callback spends it where it stands rather than posting it anywhere, so
it never reaches a mailbox, a URL or a history entry. See
`src/lib/auth/linked-emails.ts`.

## Why this is smaller than it was, and still worth care

The old version of this page argued that bounces were the single failure that
could take the front door off the product, and it was right at the time: a
restricted sender meant nobody could sign in at all.

Two things changed that, and it is worth being precise about which.

**Google carries sign-in, and it touches no mail.** A sending problem can no
longer keep anybody out of their account.

**Every address Arena mails is now one Google verified**, on an account that
asked to be written to. Nothing goes to an address a stranger typed into a
form, which is where the bounce risk actually lived: the typo, the
placeholder, the address somebody invented to see what the app does. That was
the whole argument for the MX lookup in `email-mx.ts`, and it is why that file
is gone rather than kept for luck.

What is left to protect is the notification fallback itself. A restricted
domain does not degrade it, it removes it: push reaches very few people on
iOS, which is the entire reason the fallback exists, so a player who asked to
be told something simply stops being told.

## What the app does about it

`src/lib/auth/email-address.ts` reads an address strictly, and `isSendable`
is what stands in front of every send in `src/lib/notify/send.ts`.

**1. The address has to be shaped like an address.** One `@`, a local part a
mailbox could actually have, a domain of real labels, and an alphabetic
ending. It tidies first: whitespace, `mailto:`, angle brackets, a trailing dot
and the zero-width characters that ride along with a copy from a web page.

**2. Names that can never receive are refused outright.** The RFC 2606 and
6761 reserved names (`example.com`, anything under `.test`, `.invalid`,
`.local`, `.localhost`) exist so as never to resolve, and so do send-only
mailboxes like `noreply@`. Both are a guaranteed bounce.

This runs against an address that came from an account rather than from a
form, so nobody can be asked about it. An account created before these checks
existed would otherwise be mailed every week for ever, bouncing every time,
and that is the case the guard is really for.

**What is no longer here.** The MX lookup asked the domain system whether
there was anywhere to deliver, and the "did you mean gmail.com" question
caught a domain one edit from a famous one. Both were about an address
somebody had just typed. `readEmail` still has the suggestion branch because
it is one function with two callers' worth of history in it; nothing reaches
it from a form any more.

## The dashboard half, which cannot be done in code

### Auth email is on Resend, done 2026-08-22, dormant since 2026-08-23

**Supabase Auth sends nothing now**, because nothing asks it to. The settings
below are recorded as they stand, they cost nothing where they are, and
anything that ever starts mailing through Supabase again wants them checked
rather than assumed.

The original reason still holds if that day comes: Supabase's built-in email
service is shared infrastructure with a small hourly allowance and a
reputation shared with every other project using it, while Arena already has
a Resend account and a verified domain.

In **Supabase, Project Settings, Authentication, SMTP Settings**, *Enable
Custom SMTP* is on:

| Field | Value |
|---|---|
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | a Resend API key with sending access, named `supabase-auth` |
| Sender email | `arena@upsidearena.com` |
| Sender name | `Upside Arena` |
| Minimum interval per user | `60` seconds |

The API key is a separate one from the notification key, named
`supabase-auth`, so either can be revoked without taking the other down.

### The sending domain, which is not dormant

The sender address has to be on a domain verified in Resend. An unverified one
does not bounce, it fails outright, which is worse: nothing arrives and
nothing says so. upsidearena.com is verified, with DKIM at
`resend._domainkey`, a return path at `send.upsidearena.com`, and a `p=none`
DMARC record. Those are worth checking with `dig` rather than trusting,
because a record removed at the registrar takes the notification mail down
with it and nothing in the app will say a word.

Set `RESEND_FROM` to the same address, `Upside Arena
<arena@upsidearena.com>`, in Vercel. The code defaults to `arena@upthink.ee`,
so an unset variable means the mail leaves from a domain that was never
verified for it.

The domain sends but does not receive: it has no MX record of its own, so a
reply reaches nobody. That is normal for transactional mail and it is why the
app names `app.support@upthink.ee`, a mailbox that does receive, wherever it
invites somebody to get in touch.

### Watch the number

Resend's dashboard shows bounces per day. Above about 2% is worth looking
into. With sign-in gone from the picture the cause is now almost always a real
address that has since been closed, and the fix is to stop mailing it.

## Testing without mailing strangers

`supabase start` runs a local mail server on
[127.0.0.1:54324](http://127.0.0.1:54324) and every message the local project
sends lands there and goes nowhere else.

Never test against a live address that is not your own, and never against a
made-up one: a made-up address on a real domain is a real bounce, and it is
charged to the project exactly like a stranger's would be.
