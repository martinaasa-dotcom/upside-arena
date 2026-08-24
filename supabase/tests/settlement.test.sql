-- Tests for settling a finished week without a scheduler: the claim, the
-- stale-claim takeover, and lifetime totals that survive a retry.

\set ON_ERROR_STOP on
\o /dev/null

insert into auth.users (id, email, raw_user_meta_data)
values
  ('cccccccc-0000-0000-0000-000000000001', 'cara@example.com', '{}'::jsonb),
  ('dddddddd-0000-0000-0000-000000000002', 'dev@example.com', '{}'::jsonb);

-- A finished week: Monday 10 August, so it ended Friday the 14th.
insert into public.weekly_cycles (monday, starting_balance, benchmark_open)
values ('2026-08-10', 100000, 800.00);

select public.ensure_portfolio(
  'cccccccc-0000-0000-0000-000000000001',
  (select id from public.weekly_cycles where monday = '2026-08-10'));
select public.ensure_portfolio(
  'dddddddd-0000-0000-0000-000000000002',
  (select id from public.weekly_cycles where monday = '2026-08-10'));

select public.execute_trade(
  'cccccccc-0000-0000-0000-000000000001',
  (select id from public.weekly_cycles where monday = '2026-08-10'),
  'NVDA', 'buy', 100, 200.00);

-- ---------------------------------------------------------------------------
-- Which weeks are due
-- ---------------------------------------------------------------------------

select public.assert(
  (select count(*) from public.due_cycles('2026-08-17')) = 1,
  'a week that ended last Friday is due for settling'
);

select public.assert(
  (select count(*) from public.due_cycles('2026-08-12')) = 0,
  'a week still running is not due'
);

-- The Friday itself is not over until the day is, so it is not due that day.
select public.assert(
  (select count(*) from public.due_cycles('2026-08-14')) = 0,
  'a week is not due on its own closing day'
);

-- ---------------------------------------------------------------------------
-- The claim
-- ---------------------------------------------------------------------------

select public.assert(
  public.claim_cycle_for_scoring(
    (select id from public.weekly_cycles where monday = '2026-08-10')) = true,
  'the first settler to arrive claims the week'
);

select public.assert(
  public.claim_cycle_for_scoring(
    (select id from public.weekly_cycles where monday = '2026-08-10')) = false,
  'a second settler arriving at once is turned away'
);

select public.assert(
  (select status from public.weekly_cycles where monday = '2026-08-10') = 'scoring',
  'a claimed week is marked as being scored'
);

-- A settler that died must not wedge the week for ever.
update public.weekly_cycles
set scoring_started_at = now() - interval '30 minutes'
where monday = '2026-08-10';

select public.assert(
  public.claim_cycle_for_scoring(
    (select id from public.weekly_cycles where monday = '2026-08-10')) = true,
  'a claim whose owner died can be taken over'
);

-- A settler that could not fetch prices puts the week back rather than
-- leaving it stuck until the timeout.
select public.release_cycle_claim(
  (select id from public.weekly_cycles where monday = '2026-08-10'));

select public.assert(
  (select status from public.weekly_cycles where monday = '2026-08-10') = 'open',
  'a settler that gives up releases the week for the next attempt'
);

-- ---------------------------------------------------------------------------
-- Lifetime totals
-- ---------------------------------------------------------------------------

-- NVDA closes at 240, so Cara's 20,000 is 24,000: up 4%. The market went 800
-- to 808, up 1%. Dev stayed in cash and finished flat.
select public.score_cycle(
  (select id from public.weekly_cycles where monday = '2026-08-10'),
  '{"NVDA": 240}'::jsonb,
  808.00
);

select public.assert(
  (select weeks_played from public.profiles
   where id = 'cccccccc-0000-0000-0000-000000000001') = 1,
  'settling a week counts it on the profile'
);

select public.assert(
  (select best_week_return from public.profiles
   where id = 'cccccccc-0000-0000-0000-000000000001') = 4.0000,
  'a first scored week becomes the best week'
);

select public.assert(
  (select career_alpha_avg from public.profiles
   where id = 'cccccccc-0000-0000-0000-000000000001') = 3.0000,
  'the average against the market starts at the first week'
);

select public.assert(
  (select career_alpha_avg from public.profiles
   where id = 'dddddddd-0000-0000-0000-000000000002') = -1.0000,
  'sitting in cash while the market rose counts against the average'
);

-- The one that matters. A retry must not count the week twice.
update public.weekly_cycles set status = 'open' where monday = '2026-08-10';
select public.score_cycle(
  (select id from public.weekly_cycles where monday = '2026-08-10'),
  '{"NVDA": 240}'::jsonb,
  808.00
);

select public.assert(
  (select weeks_played from public.profiles
   where id = 'cccccccc-0000-0000-0000-000000000001') = 1,
  'settling the same week twice does not count it twice'
);

select public.assert(
  (select career_alpha_avg from public.profiles
   where id = 'cccccccc-0000-0000-0000-000000000001') = 3.0000,
  'a retry leaves the average against the market alone'
);

-- ---------------------------------------------------------------------------
-- A second week averages properly
-- ---------------------------------------------------------------------------

insert into public.weekly_cycles (monday, starting_balance, benchmark_open)
values ('2026-08-17', 100000, 800.00);

select public.ensure_portfolio(
  'cccccccc-0000-0000-0000-000000000001',
  (select id from public.weekly_cycles where monday = '2026-08-17'));

-- Cara finishes flat while the market rises 1%, so she is one point behind.
select public.score_cycle(
  (select id from public.weekly_cycles where monday = '2026-08-17'),
  '{}'::jsonb,
  808.00
);

select public.assert(
  (select weeks_played from public.profiles
   where id = 'cccccccc-0000-0000-0000-000000000001') = 2,
  'a second week counts'
);

-- Three points ahead, then one behind, averages to one point ahead.
select public.assert(
  (select career_alpha_avg from public.profiles
   where id = 'cccccccc-0000-0000-0000-000000000001') = 1.0000,
  'the average against the market is a real running mean'
);

select public.assert(
  (select best_week_return from public.profiles
   where id = 'cccccccc-0000-0000-0000-000000000001') = 4.0000,
  'a worse week does not replace the best one'
);

-- ---------------------------------------------------------------------------
-- A player still cannot settle their own week
-- ---------------------------------------------------------------------------

do $$
begin
  perform set_config('request.jwt.claims',
    '{"sub": "cccccccc-0000-0000-0000-000000000001"}', true);
  set local role authenticated;

  begin
    perform public.score_cycle(
      (select id from public.weekly_cycles where monday = '2026-08-17'),
      '{"NVDA": 99999}'::jsonb, 1.00);
    raise exception 'FAILED: a player scored their own week';
  exception when insufficient_privilege then
    raise notice 'ok: a player cannot score their own week';
  end;

  begin
    perform public.claim_cycle_for_scoring(
      (select id from public.weekly_cycles where monday = '2026-08-17'));
    raise exception 'FAILED: a player claimed a week for scoring';
  exception when insufficient_privilege then
    raise notice 'ok: a player cannot claim a week for scoring';
  end;
end $$;

-- ---------------------------------------------------------------------------
-- A week is not scored on a price we do not have
-- ---------------------------------------------------------------------------
--
-- score_cycle used to value a holding at zero when its symbol was missing from
-- the closing prices. That is not a missing value, it is the worst possible
-- one: a player who held two companies through a flat week and finished level
-- was scored at minus ten per cent, permanently, because scoring is idempotent
-- and the wrong number is therefore the final one.

insert into auth.users (id, email) values
  ('99990000-0000-0000-0000-000000000001', 'unpriced@example.com');

--
-- The Monday is written out, like every other one in this file, and that is
-- the point. It used to be `current_date - 7`, which is the same date as the
-- fixture week above on exactly one day of the year: 24 August 2026, when the
-- whole suite went red on a duplicate house week and said nothing about
-- settlement at all. A suite that mixes a relative date with hardcoded ones
-- has an appointment with itself, so this one keeps its own Monday, months
-- clear of the others. Nothing here reads the calendar: score_cycle is handed
-- the prices and does not care when the week was.
insert into public.weekly_cycles (id, monday, status, starting_balance, benchmark_open)
values ('99990000-0000-0000-0000-00000000cccc', '2026-06-08', 'open', 100000, 100);

select public.ensure_portfolio(
  '99990000-0000-0000-0000-000000000001', '99990000-0000-0000-0000-00000000cccc');

select public.execute_trade(
  '99990000-0000-0000-0000-000000000001', '99990000-0000-0000-0000-00000000cccc',
  'AAPL', 'buy', 100, 100);
select public.execute_trade(
  '99990000-0000-0000-0000-000000000001', '99990000-0000-0000-0000-00000000cccc',
  'MSFT', 'buy', 100, 100);

do $$
begin
  perform public.score_cycle(
    '99990000-0000-0000-0000-00000000cccc', '{"AAPL": 100}'::jsonb, 100);
  perform public.assert(false, 'a week with an unpriced holding is refused');
exception when others then
  perform public.assert(
    sqlerrm like '%no closing price for MSFT%',
    'a week with an unpriced holding is refused, and says which company'
  );
end;
$$;

select public.assert(
  (select return_percent from public.portfolios
   where cycle_id = '99990000-0000-0000-0000-00000000cccc') is null,
  'and nothing is written, so the next attempt can still get it right'
);

-- A price of zero is the same thing wearing a number.
do $$
begin
  perform public.score_cycle(
    '99990000-0000-0000-0000-00000000cccc',
    '{"AAPL": 100, "MSFT": 0}'::jsonb, 100);
  perform public.assert(false, 'a price of zero is refused too');
exception when others then
  perform public.assert(
    sqlerrm like '%no closing price for MSFT%', 'a price of zero is refused too');
end;
$$;

do $$
begin
  perform public.score_cycle(
    '99990000-0000-0000-0000-00000000cccc',
    '{"AAPL": 100, "MSFT": 100}'::jsonb, null);
  perform public.assert(false, 'and so is a week with no benchmark close');
exception when others then
  perform public.assert(
    sqlerrm like '%benchmark close%', 'and so is a week with no benchmark close');
end;
$$;

select public.score_cycle(
  '99990000-0000-0000-0000-00000000cccc',
  '{"AAPL": 100, "MSFT": 100}'::jsonb, 100);

select public.assert(
  (select return_percent from public.portfolios
   where cycle_id = '99990000-0000-0000-0000-00000000cccc') = 0,
  'and with every price present the flat week scores as the flat week it was'
);

-- ---------------------------------------------------------------------------
-- A company nobody can price must not stop the week for everybody else
-- ---------------------------------------------------------------------------
--
-- The refusal above is right, and on its own it deadlocks. A company acquired
-- on the Thursday has no closing price and never will again, so every pass
-- raises, releases its claim and tries again forever: nobody in that week is
-- scored, not just the player holding it. So the caller may name what it could
-- not price, and those positions are worth what was paid for them, which is
-- both a price Arena really saw and the figure every screen has been showing
-- for that holding all week.

insert into auth.users (id, email) values
  ('99990000-0000-0000-0000-000000000002', 'gone@example.com');

insert into public.weekly_cycles (id, monday, status, starting_balance, benchmark_open)
values ('99990000-0000-0000-0000-00000000dddd', '2026-06-15', 'open', 100000, 100);

select public.ensure_portfolio(
  '99990000-0000-0000-0000-000000000002', '99990000-0000-0000-0000-00000000dddd');

-- 10,000 of a company that still trades, and 5,000 of one that stops.
select public.execute_trade(
  '99990000-0000-0000-0000-000000000002', '99990000-0000-0000-0000-00000000dddd',
  'AAPL', 'buy', 100, 100);
select public.execute_trade(
  '99990000-0000-0000-0000-000000000002', '99990000-0000-0000-0000-00000000dddd',
  'GONE', 'buy', 100, 50);

do $$
begin
  perform public.score_cycle(
    '99990000-0000-0000-0000-00000000dddd', '{"AAPL": 110}'::jsonb, 110);
  perform public.assert(false, 'a company that is neither priced nor named still stops the week');
exception when others then
  perform public.assert(
    sqlerrm like '%no closing price for GONE%',
    'a company that is neither priced nor named still stops the week'
  );
end;
$$;

select public.score_cycle(
  '99990000-0000-0000-0000-00000000dddd', '{"AAPL": 110}'::jsonb, 110,
  array['GONE']);

-- 85,000 in cash, 11,000 of Apple at the close, and the 5,000 that went into
-- the company nobody can price. One per cent, and not a wipeout.
select public.assert(
  (select final_value from public.portfolios
   where cycle_id = '99990000-0000-0000-0000-00000000dddd') = 101000,
  'a named company is worth what was paid for it, and the week is scored'
);

select public.assert(
  (select status from public.weekly_cycles
   where id = '99990000-0000-0000-0000-00000000dddd') = 'closed',
  'and the week is closed rather than left for a pass that will never come'
);

-- Naming one is not permission to skip the others.
insert into public.weekly_cycles (id, monday, status, starting_balance, benchmark_open)
values ('99990000-0000-0000-0000-00000000eeee', '2026-06-22', 'open', 100000, 100);

select public.ensure_portfolio(
  '99990000-0000-0000-0000-000000000002', '99990000-0000-0000-0000-00000000eeee');

select public.execute_trade(
  '99990000-0000-0000-0000-000000000002', '99990000-0000-0000-0000-00000000eeee',
  'GONE', 'buy', 100, 50);
select public.execute_trade(
  '99990000-0000-0000-0000-000000000002', '99990000-0000-0000-0000-00000000eeee',
  'MSFT', 'buy', 100, 100);

do $$
begin
  perform public.score_cycle(
    '99990000-0000-0000-0000-00000000eeee', '{}'::jsonb, 110, array['GONE']);
  perform public.assert(false, 'naming one company does not excuse the rest');
exception when others then
  perform public.assert(
    sqlerrm like '%no closing price for MSFT%',
    'naming one company does not excuse the rest'
  );
end;
$$;
