-- Closing an account, and what has to be gone afterwards.
--
-- Several suites already check their own corner of this: the streak goes, the
-- rewards go. This is the whole of it, and it is written so that a table added
-- next year is covered without anybody remembering to come back here.
--
-- Two questions, and they fail differently.
--
-- The first is structural: does every table that keys rows to a person say
-- what happens when that person leaves? A new table with a user_id and no
-- cascade is the realistic way this breaks -- nobody removes a cascade, but
-- people add tables. Asking the catalogue rather than a list means the check
-- covers the table nobody thought to add to it.
--
-- The second is behavioural, because a cascade that exists is not the same as
-- one that reaches. Trades and holdings hang off a portfolio rather than off a
-- person, so they are only erased if the chain through portfolios holds. That
-- is exactly the sort of thing that reads as fine and is not.

-- ---------------------------------------------------------------------------
-- Every table keyed to a person names what happens when they leave
-- ---------------------------------------------------------------------------

select public.assert(
  not exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
    join pg_attribute a on a.attrelid = c.oid and a.attname = 'user_id' and a.attnum > 0
    where c.relkind = 'r'
      and not exists (
        select 1
        from pg_constraint con
        where con.conrelid = c.oid
          and con.contype = 'f'
          and a.attnum = any (con.conkey)
          and con.confrelid = 'auth.users'::regclass
      )
  ),
  'every table with a user_id says which account it belongs to'
);

/*
  And nothing is left pointing at somebody who has gone.

  Two ways to satisfy that, and only two. A row that is *about* a person goes
  with them: a portfolio, a streak, a push subscription, a coin balance. A
  column that merely *records* a person on a row that belongs to other people
  is emptied instead, and `weekly_cycles.created_by` is the one of those --
  a league's three month battle must not be deleted out from under four other
  players because the person who started it closed their account.

  Anything else, and in particular `no action`, is the failure this is looking
  for: a foreign key that simply refuses the delete, so closing an account
  raises rather than erasing.
*/
select public.assert(
  not exists (
    select 1
    from pg_constraint con
    join pg_class c on c.oid = con.conrelid
    join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
    where con.contype = 'f'
      and con.confrelid = 'auth.users'::regclass
      and con.confdeltype not in ('c', 'n')
  ),
  'and every one of those is erased with the account rather than orphaned'
);

-- A column that empties has to be able to hold nothing. Set null on a not-null
-- column is a delete that raises, which is the case above wearing a disguise.
select public.assert(
  not exists (
    select 1
    from pg_constraint con
    join pg_class c on c.oid = con.conrelid
    join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
    join pg_attribute a on a.attrelid = c.oid and a.attnum = any (con.conkey)
    where con.contype = 'f'
      and con.confrelid = 'auth.users'::regclass
      and con.confdeltype = 'n'
      and a.attnotnull
  ),
  'and a column that is emptied on the way out is one that may be empty'
);

-- ---------------------------------------------------------------------------
-- And it actually reaches, including the rows that hang off a portfolio
-- ---------------------------------------------------------------------------

insert into auth.users (id, email) values
  ('aaaa0000-0000-0000-0000-000000000001', 'goes@example.com'),
  ('aaaa0000-0000-0000-0000-000000000002', 'stays@example.com');

insert into public.weekly_cycles (id, monday, status, starting_balance)
values ('cccc0000-0000-0000-0000-000000000001', current_date, 'open', 100000);

-- Built and traded the way the app does it, so the rows are the real shape.
select public.ensure_portfolio(
  'aaaa0000-0000-0000-0000-000000000001', 'cccc0000-0000-0000-0000-000000000001');
select public.ensure_portfolio(
  'aaaa0000-0000-0000-0000-000000000002', 'cccc0000-0000-0000-0000-000000000001');

select public.execute_trade(
  'aaaa0000-0000-0000-0000-000000000001', 'cccc0000-0000-0000-0000-000000000001',
  'AAPL', 'buy', 2, 10);
select public.execute_trade(
  'aaaa0000-0000-0000-0000-000000000002', 'cccc0000-0000-0000-0000-000000000001',
  'AAPL', 'buy', 2, 10);

insert into public.terms_acceptances (user_id, document, version)
values ('aaaa0000-0000-0000-0000-000000000001', 'terms', '1'),
       ('aaaa0000-0000-0000-0000-000000000002', 'terms', '1');

insert into public.push_subscriptions (user_id, endpoint, p256dh, auth)
values ('aaaa0000-0000-0000-0000-000000000001', 'https://example.test/1', 'k', 'a'),
       ('aaaa0000-0000-0000-0000-000000000002', 'https://example.test/2', 'k', 'a');

select public.assert(
  (select count(*) from public.trades) = 2
    and (select count(*) from public.holdings) = 2
    and (select count(*) from public.profiles) = 2,
  'two players, each with a week behind them'
);

delete from auth.users where id = 'aaaa0000-0000-0000-0000-000000000001';

select public.assert(
  not exists (
    select 1 from public.profiles where id = 'aaaa0000-0000-0000-0000-000000000001'
  ),
  'closing an account erases the profile'
);

select public.assert(
  not exists (
    select 1 from public.portfolios
    where user_id = 'aaaa0000-0000-0000-0000-000000000001'
  ),
  'and the weeks they played'
);

select public.assert(
  (select count(*) from public.trades) = 1
    and (select count(*) from public.holdings) = 1,
  'and the trades and holdings under them, which hang off a portfolio rather than a person'
);

select public.assert(
  (select count(*) from public.terms_acceptances) = 1
    and (select count(*) from public.push_subscriptions) = 1,
  'and what they agreed to, and the devices they were reachable on'
);

-- The half that would make erasure worthless if it were wrong.
select public.assert(
  exists (
    select 1 from public.profiles where id = 'aaaa0000-0000-0000-0000-000000000002'
  )
    and (select count(*) from public.portfolios) = 1
    and (select count(*) from public.trades) = 1,
  'and takes nothing at all from anybody else'
);
