-- One account, more than one address.
--
-- A player has one Arena account and one player tag, and may reach it from
-- more than one mailbox. Nothing about the game is per address: the tag, the
-- record, the leagues and the streak all hang off the account, so a second
-- address that made a second account would be a second person as far as every
-- table here is concerned.
--
-- What this adds is a list of the other addresses that reach one account.
-- Supabase still holds exactly one auth user with one primary email; these
-- rows are checked before a sign-in link is sent and before a Google identity
-- is turned into a session, and the session that comes out is the account's
-- own. No auth user is duplicated, and nothing in the game learns a new key.

create table public.account_emails (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,

  -- Stored lowercase, because a mailbox is not case sensitive in any system
  -- anybody uses and two spellings of one address must not be two rows.
  email text not null,

  /*
    A pending address holds the sha256 of the token that was mailed to it,
    never the token. Somebody with a copy of this table still cannot claim an
    address with it, which is the whole reason to hash something we could
    just as easily have kept.
  */
  token_hash text,
  token_expires_at timestamptz,

  -- Null until the person proved they can read that mailbox.
  verified_at timestamptz,

  created_at timestamptz not null default now(),

  constraint account_emails_lowercase check (email = lower(email)),
  constraint account_emails_shape check (position('@' in email) > 1)
);

-- One address reaches one account. This is the constraint the whole feature
-- rests on: without it a second account could claim an address that already
-- signs somebody else in.
create unique index account_emails_email_idx on public.account_emails (email);
create index account_emails_user_idx on public.account_emails (user_id);

-- A pending token is looked up by its hash, and two rows must never share one.
create unique index account_emails_token_idx
  on public.account_emails (token_hash)
  where token_hash is not null;

alter table public.account_emails enable row level security;

-- A player reads the addresses on their own account and no one else's.
create policy "a user reads their own addresses"
  on public.account_emails for select
  to authenticated
  using (auth.uid() = user_id);

/*
  And takes one off. Deleting is the only write a client may make: adding one
  is the server's, because adding is what has to check that the address is not
  already signing somebody else in, and a check a client performs on itself is
  not a check.
*/
create policy "a user removes their own addresses"
  on public.account_emails for delete
  to authenticated
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Who already signs in with an address
-- ---------------------------------------------------------------------------
-- auth.users is not reachable over the API at all, not even with the service
-- role, so the one question the server needs answered about it is asked
-- through a function. It returns an id and nothing else: no name, no
-- timestamps, nothing that would turn a sign-in form into a way of reading
-- somebody's account.

create or replace function public.account_for_login_email(p_email text)
returns uuid
language sql
security definer
set search_path = public
as $$
  select u.id
  from auth.users u
  where lower(u.email) = lower(p_email)
  limit 1;
$$;

revoke all on function public.account_for_login_email(text) from public;
revoke all on function public.account_for_login_email(text) from anon;
revoke all on function public.account_for_login_email(text) from authenticated;
grant execute on function public.account_for_login_email(text) to service_role;

-- ---------------------------------------------------------------------------
-- Whether an account has ever been used
-- ---------------------------------------------------------------------------
-- Somebody who signed in with their second address before this existed has an
-- empty account sitting on it, and that account is the only thing stopping the
-- address being added to the one they actually play on. An empty account is
-- worth nothing to anybody, so joining the two closes it.
--
-- "Empty" is answered here rather than in the app, and it is deliberately
-- strict: no tag, no finished onboarding, no trade, no league, no shared week,
-- and nothing to do with money. Anything at all that a person would miss makes
-- this false, and then the two accounts are not joined and a human is asked.

create or replace function public.account_never_played(p_user uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select
    not exists (
      select 1 from public.profiles p
      where p.id = p_user
        and (p.handle is not null or p.onboarded_at is not null)
    )
    and not exists (
      select 1
      from public.trades t
      join public.portfolios pf on pf.id = t.portfolio_id
      where pf.user_id = p_user
    )
    and not exists (select 1 from public.league_members lm where lm.user_id = p_user)
    and not exists (select 1 from public.leagues l where l.owner_id = p_user)
    and not exists (select 1 from public.share_cards sc where sc.user_id = p_user)
    and not exists (select 1 from public.billing_customers bc where bc.user_id = p_user)
    and not exists (select 1 from public.entitlements e where e.user_id = p_user);
$$;

revoke all on function public.account_never_played(uuid) from public;
revoke all on function public.account_never_played(uuid) from anon;
revoke all on function public.account_never_played(uuid) from authenticated;
grant execute on function public.account_never_played(uuid) to service_role;
