-- One account, more than one address.
--
-- What is checked here is what the database is responsible for: who may read
-- the list, who may write to it, that one address cannot reach two accounts,
-- and that "never played" means what the app is told it means before an empty
-- account is closed on the strength of it.

\set ON_ERROR_STOP on
\o /dev/null

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'martin@work.example'),
  ('22222222-2222-2222-2222-222222222222', 'other@work.example'),
  ('33333333-3333-3333-3333-333333333333', 'spare@gmail.example');

-- Written by the server, which is the only thing that may add one.
insert into public.account_emails (user_id, email, verified_at) values
  ('11111111-1111-1111-1111-111111111111', 'martin@gmail.example', now());

insert into public.account_emails (user_id, email, token_hash, token_expires_at) values
  ('11111111-1111-1111-1111-111111111111', 'martin@old.example', 'a-digest', now() + interval '1 hour');

-- ---------------------------------------------------------------------------
-- Who may read the list
-- ---------------------------------------------------------------------------

begin;
  set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111"}';
  set local role authenticated;

  select public.assert(
    (select count(*) from public.account_emails) = 2,
    'a player reads the addresses on their own account, confirmed or waiting'
  );
commit;

begin;
  set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222"}';
  set local role authenticated;

  select public.assert(
    (select count(*) from public.account_emails) = 0,
    'and reads nothing about anybody else''s'
  );
commit;

begin;
  set local role anon;

  select public.assert(
    (select count(*) from public.account_emails) = 0,
    'a signed-out visitor reads none at all'
  );
commit;

-- ---------------------------------------------------------------------------
-- Who may write
-- ---------------------------------------------------------------------------

do $$
begin
  begin
    perform set_config(
      'request.jwt.claims',
      '{"sub": "22222222-2222-2222-2222-222222222222"}',
      true
    );
    set local role authenticated;

    /*
      The whole point of adding an address is the check that runs first: is
      anybody else already reached by it, and has that account been played. A
      client that could insert would be a client checking itself, so there is
      no insert policy at all and this is refused by the database rather than
      by a branch in the app.
    */
    insert into public.account_emails (user_id, email, verified_at)
    values ('22222222-2222-2222-2222-222222222222', 'grabbed@gmail.example', now());

    raise exception 'FAILED: a player added an address to their own account';
  exception
    when insufficient_privilege then
      raise notice 'ok: a player cannot add an address themselves';
  end;
end
$$;

begin;
  set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222"}';
  set local role authenticated;

  -- The policy filters the row out, so this deletes nothing rather than erroring.
  delete from public.account_emails where email = 'martin@gmail.example';
commit;

select public.assert(
  (select count(*) from public.account_emails
   where email = 'martin@gmail.example') = 1,
  'a player cannot take an address off somebody else''s account'
);

begin;
  set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111"}';
  set local role authenticated;

  delete from public.account_emails where email = 'martin@old.example';
commit;

select public.assert(
  (select count(*) from public.account_emails
   where email = 'martin@old.example') = 0,
  'a player takes an address off their own account, which is the one write they have'
);

-- ---------------------------------------------------------------------------
-- One address, one account
-- ---------------------------------------------------------------------------

do $$
begin
  begin
    insert into public.account_emails (user_id, email, verified_at)
    values ('22222222-2222-2222-2222-222222222222', 'martin@gmail.example', now());

    raise exception 'FAILED: one address was allowed to reach two accounts';
  exception
    when unique_violation then
      raise notice 'ok: an address reaches one account and no more';
  end;
end
$$;

do $$
begin
  begin
    insert into public.account_emails (user_id, email)
    values ('22222222-2222-2222-2222-222222222222', 'Shouty@Gmail.example');

    raise exception 'FAILED: an address was stored in a case of its own';
  exception
    when check_violation then
      raise notice 'ok: an address is stored lowercase, so one mailbox is one row';
  end;
end
$$;

select public.assert(
  (select count(*) from public.account_emails
   where user_id = '11111111-1111-1111-1111-111111111111') = 1,
  'and the row that was already there is untouched by the attempt'
);

-- ---------------------------------------------------------------------------
-- Who signs in with an address
-- ---------------------------------------------------------------------------

select public.assert(
  public.account_for_login_email('OTHER@work.example')
    = '22222222-2222-2222-2222-222222222222',
  'the account that signs in with an address is found whatever case it is typed in'
);

select public.assert(
  public.account_for_login_email('nobody@nowhere.example') is null,
  'and an address nobody signs in with belongs to nobody'
);

-- ---------------------------------------------------------------------------
-- Whether an account has ever been used
-- ---------------------------------------------------------------------------
-- This is what stands between joining two accounts and erasing somebody's
-- record, so each thing it looks at gets its own line.

select public.assert(
  public.account_never_played('33333333-3333-3333-3333-333333333333'),
  'an account that has done nothing at all has never been played'
);

update public.profiles set handle = 'spare_one'
where id = '33333333-3333-3333-3333-333333333333';

select public.assert(
  not public.account_never_played('33333333-3333-3333-3333-333333333333'),
  'a player tag alone is enough to make it somebody''s account'
);

update public.profiles set handle = null, onboarded_at = now()
where id = '33333333-3333-3333-3333-333333333333';

select public.assert(
  not public.account_never_played('33333333-3333-3333-3333-333333333333'),
  'so is having finished onboarding'
);

update public.profiles set onboarded_at = null
where id = '33333333-3333-3333-3333-333333333333';

select public.ensure_cycle('2026-08-17', 100000, 500);
select public.ensure_portfolio(
  '33333333-3333-3333-3333-333333333333',
  (select id from public.weekly_cycles where monday = '2026-08-17'));

select public.assert(
  public.account_never_played('33333333-3333-3333-3333-333333333333'),
  'an empty portfolio is not a week played, because signing in makes one'
);

select public.execute_trade(
  '33333333-3333-3333-3333-333333333333',
  (select id from public.weekly_cycles where monday = '2026-08-17'),
  'AAPL', 'buy', 10, 100, 100, 100, '2026-08-18');

select public.assert(
  not public.account_never_played('33333333-3333-3333-3333-333333333333'),
  'one trade is a record, and a record is never closed to join two accounts'
);

-- ---------------------------------------------------------------------------
-- Closing an account
-- ---------------------------------------------------------------------------

begin;
  set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111"}';
  set local role authenticated;

  select public.delete_own_account();
commit;

select public.assert(
  (select count(*) from public.account_emails
   where user_id = '11111111-1111-1111-1111-111111111111') = 0,
  'closing an account takes its other addresses with it'
);
