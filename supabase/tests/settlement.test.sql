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
