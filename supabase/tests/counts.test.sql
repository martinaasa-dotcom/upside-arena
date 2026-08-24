-- Counting in the database rather than on the wire.
--
-- Three functions from migration 0030, each replacing a read that fetched a
-- row per thing in order to report how many things there were. What is
-- asserted here is that they count the same as the reads they replaced, and
-- that they are the service role's alone.

\set ON_ERROR_STOP on
\o /dev/null

insert into auth.users (id, email, raw_user_meta_data)
values
  ('11111111-0000-0000-0000-000000000001', 'ann@example.com', '{}'::jsonb),
  ('22222222-0000-0000-0000-000000000002', 'ben@example.com', '{}'::jsonb),
  ('33333333-0000-0000-0000-000000000003', 'cal@example.com', '{}'::jsonb);

insert into public.leagues (id, name, invite_code, owner_id)
values
  ('aaaa0000-0000-0000-0000-000000000001', 'Ann''s league', 'ANNLEAG1',
   '11111111-0000-0000-0000-000000000001'),
  ('aaaa0000-0000-0000-0000-000000000002', 'A quiet league', 'QUIET002',
   '22222222-0000-0000-0000-000000000002');

insert into public.league_members (league_id, user_id, role)
values
  ('aaaa0000-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', 'owner'),
  ('aaaa0000-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000002', 'member'),
  ('aaaa0000-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000003', 'member'),
  ('aaaa0000-0000-0000-0000-000000000002', '22222222-0000-0000-0000-000000000002', 'owner')
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- league_member_counts
-- ---------------------------------------------------------------------------

select public.assert(
  (select members from public.league_member_counts(
     array['aaaa0000-0000-0000-0000-000000000001']::uuid[]
   )) = 3,
  'a league of three counts three'
);

select public.assert(
  (select count(*) from public.league_member_counts(
     array['aaaa0000-0000-0000-0000-000000000001',
           'aaaa0000-0000-0000-0000-000000000002']::uuid[]
   )) = 2,
  'two leagues come back as two rows, not five'
);

select public.assert(
  (select count(*) from public.league_member_counts(
     array['aaaa0000-0000-0000-0000-0000000000ff']::uuid[]
   )) = 0,
  'a league nobody is in is absent rather than zero'
);

select public.assert(
  (select count(*) from public.league_member_counts(null)) = 0,
  'no leagues asked about is no rows, not every league'
);

-- ---------------------------------------------------------------------------
-- portfolio_trade_counts and symbols_in_cycle
-- ---------------------------------------------------------------------------

insert into public.weekly_cycles (id, monday, status, benchmark_open, starting_balance)
values ('bbbb0000-0000-0000-0000-000000000001', '2026-06-08', 'open', 500, 100000);

insert into public.portfolios (id, user_id, cycle_id, starting_balance, cash)
values
  ('cccc0000-0000-0000-0000-000000000001',
   '11111111-0000-0000-0000-000000000001',
   'bbbb0000-0000-0000-0000-000000000001', 100000, 50000),
  ('cccc0000-0000-0000-0000-000000000002',
   '22222222-0000-0000-0000-000000000002',
   'bbbb0000-0000-0000-0000-000000000001', 100000, 100000);

insert into public.holdings (portfolio_id, symbol, quantity, cost_basis)
values
  ('cccc0000-0000-0000-0000-000000000001', 'AAPL', 100, 20000),
  ('cccc0000-0000-0000-0000-000000000001', 'MSFT', 50, 20000);

insert into public.trades (portfolio_id, symbol, side, quantity, price, value)
values
  ('cccc0000-0000-0000-0000-000000000001', 'AAPL', 'buy', 100, 200, 20000),
  ('cccc0000-0000-0000-0000-000000000001', 'MSFT', 'buy', 50, 400, 20000),
  ('cccc0000-0000-0000-0000-000000000001', 'AAPL', 'sell', 10, 210, 2100);

select public.assert(
  (select trades from public.portfolio_trade_counts(
     array['cccc0000-0000-0000-0000-000000000001']::uuid[]
   )) = 3,
  'three trades count as three'
);

/*
  A portfolio nobody traded in is absent rather than nought, which is the
  distinction both callers rely on: they ask whether somebody traded at all,
  and an absent row and a zero row have to mean the same thing to them.
*/
select public.assert(
  (select count(*) from public.portfolio_trade_counts(
     array['cccc0000-0000-0000-0000-000000000002']::uuid[]
   )) = 0,
  'a portfolio with no trades in it is absent'
);

select public.assert(
  (select array_agg(symbol order by symbol) from public.symbols_in_cycle(
     'bbbb0000-0000-0000-0000-000000000001'
   )) = array['AAPL', 'MSFT'],
  'a week reports the companies it holds'
);

/*
  Two people holding the same company is one symbol. This is the whole point
  of the function: the caller wants a price list, and asking a provider for
  AAPL twice is a request wasted.
*/
insert into public.holdings (portfolio_id, symbol, quantity, cost_basis)
values ('cccc0000-0000-0000-0000-000000000002', 'AAPL', 5, 1000);

select public.assert(
  (select count(*) from public.symbols_in_cycle(
     'bbbb0000-0000-0000-0000-000000000001'
   )) = 2,
  'and reports each of them once, however many people hold it'
);

select public.assert(
  (select count(*) from public.symbols_in_cycle(
     'bbbb0000-0000-0000-0000-0000000000ff'
   )) = 0,
  'a week that does not exist holds nothing'
);

-- ---------------------------------------------------------------------------
-- Who may ask
-- ---------------------------------------------------------------------------
-- All three read across every player, so none of them is a browser's to call.

select public.assert(
  not has_function_privilege(
    'authenticated', 'public.league_member_counts(uuid[])', 'execute'
  ),
  'a signed-in browser cannot count anybody''s league'
);

select public.assert(
  not has_function_privilege(
    'authenticated', 'public.portfolio_trade_counts(uuid[])', 'execute'
  ),
  'nor count anybody''s trades'
);

select public.assert(
  not has_function_privilege(
    'authenticated', 'public.symbols_in_cycle(uuid)', 'execute'
  ),
  'nor read what a week is holding while it is running'
);

select public.assert(
  has_function_privilege(
    'service_role', 'public.symbols_in_cycle(uuid)', 'execute'
  ),
  'and the settler can'
);

\o
\echo 'counts.test.sql passed'
