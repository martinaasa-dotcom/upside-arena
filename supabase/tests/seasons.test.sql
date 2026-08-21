-- Tests for the season laid on top of the week: which quarter a week lands
-- in, what a season adds up, and what closing one hands out.

\set ON_ERROR_STOP on
\o /dev/null

insert into auth.users (id, email, raw_user_meta_data)
values
  ('11111111-0000-0000-0000-000000000001', 'ann@example.com', '{}'::jsonb),
  ('22222222-0000-0000-0000-000000000002', 'ben@example.com', '{}'::jsonb),
  ('33333333-0000-0000-0000-000000000003', 'cal@example.com', '{}'::jsonb),
  ('44444444-0000-0000-0000-000000000004', 'dee@example.com', '{}'::jsonb);

-- ---------------------------------------------------------------------------
-- Which season a Monday belongs to
-- ---------------------------------------------------------------------------

select public.assert(
  (public.season_for('2026-08-10')).starts_on = '2026-07-01',
  'a week in August belongs to the quarter that started in July'
);

select public.assert(
  (public.season_for('2026-08-10')).ends_on = '2026-09-30',
  'and that quarter runs to the end of September'
);

select public.assert(
  (public.season_for('2026-08-10')).name = '2026 Q3',
  'the season is named the way it is written on screen'
);

select public.assert(
  (select count(*) from public.seasons) = 1,
  'asking for the same season twice does not make a second one'
);

select public.assert(
  (public.season_for('2026-11-02')).name = '2026 Q4',
  'a week in November belongs to the next quarter'
);

select public.assert(
  (public.season_for('2026-01-05')).starts_on = '2026-01-01',
  'and the first quarter starts on the first of January'
);

-- ---------------------------------------------------------------------------
-- A settled week rolls into its season
-- ---------------------------------------------------------------------------

-- Three weeks of the same quarter. Ann buys and does well, Ben buys and does
-- badly, and Cal opens the app every week but never buys anything, which is
-- a perfectly ordinary way to play and has to end up in the table.
insert into public.weekly_cycles (monday, starting_balance, benchmark_open)
values
  ('2026-07-06', 100000, 800.00),
  ('2026-07-13', 100000, 800.00),
  ('2026-07-20', 100000, 800.00);

do $$
declare
  week record;
begin
  for week in
    select id from public.weekly_cycles order by monday
  loop
    perform public.ensure_portfolio('11111111-0000-0000-0000-000000000001', week.id);
    perform public.ensure_portfolio('22222222-0000-0000-0000-000000000002', week.id);
    perform public.ensure_portfolio('33333333-0000-0000-0000-000000000003', week.id);

    perform public.execute_trade(
      '11111111-0000-0000-0000-000000000001', week.id, 'NVDA', 'buy', 100, 200.00);
    perform public.execute_trade(
      '22222222-0000-0000-0000-000000000002', week.id, 'INTC', 'buy', 100, 200.00);
  end loop;
end;
$$;

-- The market is flat all three weeks, so a return is also what somebody is
-- ahead of it by. Ann's shares rise, Ben's fall.
select public.score_cycle(
  (select id from public.weekly_cycles where monday = '2026-07-06'),
  '{"NVDA": 220.00, "INTC": 180.00}'::jsonb, 800.00);

select public.assert(
  (select count(*) from public.season_results) = 3,
  'everyone whose week was scored gets a season row, trades or not'
);

select public.assert(
  (select weeks_played from public.season_results
   where user_id = '11111111-0000-0000-0000-000000000001') = 1,
  'a settled week counts once toward the season'
);

select public.assert(
  (select weeks_ahead from public.season_results
   where user_id = '11111111-0000-0000-0000-000000000001') = 1,
  'a week finished ahead of the market is counted as one'
);

select public.assert(
  (select weeks_ahead from public.season_results
   where user_id = '22222222-0000-0000-0000-000000000002') = 0,
  'and a week finished behind it is not'
);

select public.assert(
  (select season_id from public.weekly_cycles where monday = '2026-07-06') is not null,
  'the week records which season it was played in'
);

-- Scoring the same week again must not count it twice, because Stripe is not
-- the only thing in this application that retries.
select public.score_cycle(
  (select id from public.weekly_cycles where monday = '2026-07-06'),
  '{"NVDA": 220.00, "INTC": 180.00}'::jsonb, 800.00);

select public.assert(
  (select weeks_played from public.season_results
   where user_id = '11111111-0000-0000-0000-000000000001') = 1,
  'settling a week twice does not count it twice in the season'
);

-- ---------------------------------------------------------------------------
-- Adding up a season
-- ---------------------------------------------------------------------------

select public.score_cycle(
  (select id from public.weekly_cycles where monday = '2026-07-13'),
  '{"NVDA": 210.00, "INTC": 190.00}'::jsonb, 800.00);
select public.score_cycle(
  (select id from public.weekly_cycles where monday = '2026-07-20'),
  '{"NVDA": 240.00, "INTC": 170.00}'::jsonb, 800.00);

select public.assert(
  (select weeks_played from public.season_results
   where user_id = '11111111-0000-0000-0000-000000000001') = 3,
  'three settled weeks make three weeks played'
);

select public.assert(
  (select best_week_return from public.season_results
   where user_id = '11111111-0000-0000-0000-000000000001') = 4.0000,
  'the best week of the season is the best of them, not the last'
);

select public.assert(
  (select round(sum_benchmark_diff, 4) from public.season_results
   where user_id = '11111111-0000-0000-0000-000000000001') = 7.0000,
  'points ahead of the market add up across the season'
);

select public.assert(
  (select sum_benchmark_diff from public.season_results
   where user_id = '22222222-0000-0000-0000-000000000002') < 0,
  'and a season spent behind the market adds up to less than nothing'
);

select public.assert(
  (select final_rank from public.season_results
   where user_id = '11111111-0000-0000-0000-000000000001') is null,
  'nobody has a rank while the season is still running'
);

-- ---------------------------------------------------------------------------
-- Which seasons are due to close
-- ---------------------------------------------------------------------------

-- Named, because the checks above made a season for every quarter they asked
-- about and an empty quarter from January is due too.
select public.assert(
  not exists (select 1 from public.due_seasons('2026-08-01')
              where starts_on = '2026-07-01'),
  'a season with weeks left in it is not due'
);

select public.assert(
  exists (select 1 from public.due_seasons('2026-10-01')
          where starts_on = '2026-07-01'),
  'a season whose quarter has ended is due'
);

-- A week left unsettled inside the season holds it open, because ranking a
-- quarter with a week missing from it ranks the wrong thing.
insert into public.weekly_cycles (monday, starting_balance, benchmark_open)
values ('2026-09-28', 100000, 800.00);

select public.assert(
  not exists (select 1 from public.due_seasons('2026-10-01')
              where starts_on = '2026-07-01'),
  'a season with an unsettled week in it waits'
);

update public.weekly_cycles set status = 'closed' where monday = '2026-09-28';

select public.assert(
  exists (select 1 from public.due_seasons('2026-10-01')
          where starts_on = '2026-07-01'),
  'and is due again once that week is settled'
);

-- ---------------------------------------------------------------------------
-- Closing a season
-- ---------------------------------------------------------------------------

select public.assert(
  public.close_season(
    (select id from public.seasons where starts_on = '2026-07-01')) = 3,
  'closing the season ranks everyone who played enough of it'
);

select public.assert(
  (select final_rank from public.season_results
   where user_id = '11111111-0000-0000-0000-000000000001') = 1,
  'the player furthest ahead of the market finishes first'
);

select public.assert(
  (select final_rank from public.season_results
   where user_id = '33333333-0000-0000-0000-000000000003') = 2,
  'somebody who only ever held cash finishes level with the market, above the loss'
);

select public.assert(
  (select final_rank from public.season_results
   where user_id = '22222222-0000-0000-0000-000000000002') = 3,
  'and the player who spent the season behind it finishes last'
);

select public.assert(
  exists (select 1 from public.user_rewards
          where user_id = '11111111-0000-0000-0000-000000000001'
            and reward_id = 'title.season_champion'),
  'finishing first earns the champion title'
);

select public.assert(
  not exists (select 1 from public.user_rewards
              where user_id = '33333333-0000-0000-0000-000000000003'
                and reward_id = 'title.season_champion'),
  'and finishing second does not'
);

select public.assert(
  (select count(*) from public.user_rewards
   where reward_id = 'title.season_podium') = 3,
  'but the top three all get the podium title'
);

select public.assert(
  not exists (select 1 from public.user_rewards
              where reward_id = 'title.season_regular'),
  'three weeks of a quarter is not a season regular'
);

select public.assert(
  (select status from public.seasons where starts_on = '2026-07-01') = 'closed',
  'the season is closed once it has been ranked'
);

-- Idempotent, because a settler that crashes after ranking will come back.
select public.assert(
  public.close_season(
    (select id from public.seasons where starts_on = '2026-07-01')) = 0,
  'closing a closed season does nothing at all'
);

select public.assert(
  (select count(*) from public.user_rewards
   where reward_id = 'title.season_champion') = 1,
  'and does not crown a second champion'
);

select public.assert(
  not exists (select 1 from public.due_seasons('2026-10-01')
              where starts_on = '2026-07-01'),
  'a closed season is no longer due'
);

-- ---------------------------------------------------------------------------
-- Too few weeks to be ranked
-- ---------------------------------------------------------------------------

insert into public.weekly_cycles (monday, starting_balance, benchmark_open)
values ('2026-10-05', 100000, 800.00);

select public.ensure_portfolio('44444444-0000-0000-0000-000000000004',
  (select id from public.weekly_cycles where monday = '2026-10-05'));
select public.execute_trade('44444444-0000-0000-0000-000000000004',
  (select id from public.weekly_cycles where monday = '2026-10-05'),
  'NVDA', 'buy', 100, 200.00);

select public.score_cycle(
  (select id from public.weekly_cycles where monday = '2026-10-05'),
  '{"NVDA": 260.00}'::jsonb, 800.00);

select public.assert(
  public.close_season(
    (select id from public.seasons where starts_on = '2026-10-01')) = 0,
  'one very good week is not a season, so nobody is ranked on it'
);

select public.assert(
  (select final_rank from public.season_results
   where user_id = '44444444-0000-0000-0000-000000000004') is null,
  'and that player has no rank rather than a first place'
);

select public.assert(
  not exists (select 1 from public.user_rewards
              where user_id = '44444444-0000-0000-0000-000000000004'),
  'nor a title for it'
);

-- ---------------------------------------------------------------------------
-- Who may read and write a season
-- ---------------------------------------------------------------------------

begin;

set local role authenticated;
set local request.jwt.claims to
  '{"sub": "11111111-0000-0000-0000-000000000001", "role": "authenticated"}';

select public.assert(
  (select count(*) from public.seasons) > 0,
  'a player can see when the seasons run'
);

select public.assert(
  (select count(*) from public.season_results) > 0,
  'and can read the season standings, the same as a league table'
);

rollback;

-- The role has to be set inside the block, because psql wraps each statement
-- in a transaction of its own and a local role would not survive to the next.
do $$
begin
  perform set_config('request.jwt.claims',
    '{"sub": "11111111-0000-0000-0000-000000000001"}', true);
  set local role authenticated;

  begin
    update public.season_results set final_rank = 1
    where user_id = '11111111-0000-0000-0000-000000000001';
    if found then
      raise exception 'FAILED: a player rewrote their own season result';
    end if;
    raise notice 'ok: a player cannot rewrite their own season result';
  exception when insufficient_privilege then
    raise notice 'ok: a player cannot rewrite their own season result';
  end;

  begin
    insert into public.seasons (starts_on, ends_on, name)
    values ('2027-01-01', '2027-03-31', 'made up');
    raise exception 'FAILED: a player invented a season';
  exception when insufficient_privilege then
    raise notice 'ok: a player cannot invent a season';
  end;

  begin
    perform public.close_season(
      (select id from public.seasons where starts_on = '2026-10-01'));
    raise exception 'FAILED: a player closed a season';
  exception when insufficient_privilege then
    raise notice 'ok: a player cannot close a season themselves';
  end;

  begin
    perform public.record_season_week(
      (select id from public.seasons where starts_on = '2026-10-01'),
      '11111111-0000-0000-0000-000000000001', 500, 500);
    raise exception 'FAILED: a player added a week to their own season';
  exception when insufficient_privilege then
    raise notice 'ok: a player cannot add a week to their own season';
  end;
end $$;
