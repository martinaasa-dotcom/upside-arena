-- Battles: a league's own contest, running beside the house week.
--
-- Four things are load-bearing here and each of them is a way somebody's
-- result could quietly become the wrong number:
--
--   1. A battle must not touch a career. The house week is what everybody
--      plays under the same rules, and it is the only thing weeks_played, a
--      best week and a season may be built from.
--
--   2. A short must be valued as a short, at settlement as well as on screen.
--      The direction is on the cycle so the two cannot disagree.
--
--   3. A battle belongs to its league, and to nobody else.
--
--   4. A house week and a battle may start on the same Monday, and asking for
--      the house week must never return the battle.

\set ON_ERROR_STOP on
\o /dev/null

insert into auth.users (id, email, raw_user_meta_data)
values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'ana@example.com', '{}'::jsonb),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'ben@example.com', '{}'::jsonb),
  ('cccccccc-0000-0000-0000-000000000003', 'cal@example.com', '{}'::jsonb);

-- Ana's league, with Ben in it. Cal is nowhere near it.
select public.create_league(
  'aaaaaaaa-0000-0000-0000-000000000001', 'The Pit', null, 3, 20
);

select public.join_league(
  'bbbbbbbb-0000-0000-0000-000000000002',
  (select invite_code from public.leagues where name = 'The Pit'),
  10
);

-- ---------------------------------------------------------------------------
-- A house week and a battle can share a Monday
-- ---------------------------------------------------------------------------

select public.ensure_cycle('2026-08-17', 100000, 776.18);

select public.create_battle(
  'aaaaaaaa-0000-0000-0000-000000000001',
  (select id from public.leagues where name = 'The Pit'),
  'silicon', 'long', 'week',
  '2026-08-17', '2026-08-21',
  100000, 'SOXX', 200.00
);

select public.assert(
  (select count(*) from public.weekly_cycles where monday = '2026-08-17') = 2,
  'a league battle can start on the same Monday as the house week'
);

select public.assert(
  (select cadence from public.weekly_cycles
    where league_id is not null and monday = '2026-08-17') = 'always',
  'a battle started without a cadence is the open book'
);

-- The one the whole app runs on must still be the house one. Without the
-- league_id clause in ensure_cycle this comes back as somebody's battle.
select public.ensure_cycle('2026-08-17', 100000, 776.18);

select public.assert(
  (select league_id is null and benchmark_symbol = 'SPY'
   from public.ensure_cycle('2026-08-17', 100000, 776.18)),
  'asking for the house week never returns a battle that started the same day'
);

select public.assert(
  (select count(*) from public.weekly_cycles where monday = '2026-08-17') = 2,
  'and asking again still does not create a third'
);

-- A league runs one at a time. Four contests at once is four scoreboards.
do $$
begin
  perform public.create_battle(
    'bbbbbbbb-0000-0000-0000-000000000002',
    (select id from public.leagues where name = 'The Pit'),
    'crypto', 'long', 'week', '2026-08-17', '2026-08-21', 100000, 'BTC-USD', 60000
  );
  raise exception 'should not reach here';
exception
  when others then
    perform public.assert(
      sqlerrm like '%already has a battle running%',
      'a league runs one battle at a time'
    );
end
$$;

-- And it is the league's, not anybody's who guesses its id.
do $$
begin
  perform public.create_battle(
    'cccccccc-0000-0000-0000-000000000003',
    (select id from public.leagues where name = 'The Pit'),
    'crypto', 'long', 'week', '2026-08-17', '2026-08-21', 100000, 'BTC-USD', 60000
  );
  raise exception 'should not reach here';
exception
  when others then
    perform public.assert(
      sqlerrm like '%not a member%',
      'somebody outside the league cannot start one inside it'
    );
end
$$;

-- ---------------------------------------------------------------------------
-- The window
-- ---------------------------------------------------------------------------

-- The Pit's battle runs 2026-08-17 to 2026-08-21. The date the caller hands
-- in is what decides the window, because the database has no opinion about
-- New York.
do $$
declare
  battle_id uuid := (
    select id from public.weekly_cycles where league_id is not null limit 1
  );
begin
  begin
    perform public.execute_trade(
      'aaaaaaaa-0000-0000-0000-000000000001', battle_id,
      'NVDA', 'buy', 10, 100, 10, 500, '2026-08-14'
    );
    raise exception 'should not reach here';
  exception
    when others then
      perform public.assert(
        sqlerrm like '%has not started%',
        'a battle takes no trade before its first day'
      );
  end;

  begin
    perform public.execute_trade(
      'aaaaaaaa-0000-0000-0000-000000000001', battle_id,
      'NVDA', 'buy', 10, 100, 10, 500, '2026-08-24'
    );
    raise exception 'should not reach here';
  exception
    when others then
      perform public.assert(
        sqlerrm like '%closed for trading%',
        'and none after its last'
      );
  end;

  -- Somebody who is not in the league cannot trade in its battle, whatever
  -- they know about the id.
  begin
    perform public.execute_trade(
      'cccccccc-0000-0000-0000-000000000003', battle_id,
      'NVDA', 'buy', 10, 100, 10, 500, '2026-08-18'
    );
    raise exception 'should not reach here';
  exception
    when others then
      perform public.assert(
        sqlerrm like '%not a member%',
        'and nobody outside the league can trade in it'
      );
  end;
end
$$;

-- ---------------------------------------------------------------------------
-- A battle never touches a career
-- ---------------------------------------------------------------------------

do $$
declare
  battle_id uuid := (
    select id from public.weekly_cycles where league_id is not null limit 1
  );
begin
  perform public.execute_trade(
    'aaaaaaaa-0000-0000-0000-000000000001', battle_id,
    'NVDA', 'buy', 100, 200, 10, 500, '2026-08-18'
  );

  perform public.score_cycle(
    battle_id, '{"NVDA": 220, "SOXX": 210}'::jsonb, 210
  );
end
$$;

select public.assert(
  (select weeks_played from public.profiles
   where id = 'aaaaaaaa-0000-0000-0000-000000000001') = 0,
  'a settled battle adds nothing to a lifetime record'
);

select public.assert(
  (select best_week_return from public.profiles
   where id = 'aaaaaaaa-0000-0000-0000-000000000001') is null,
  'nor to a best week'
);

select public.assert(
  (select count(*) from public.seasons) = 0,
  'and it does not open a season, let alone enter anybody in one'
);

select public.assert(
  (select season_id from public.weekly_cycles
   where league_id is not null limit 1) is null,
  'a battle belongs to no season'
);

-- It is still settled, and settled correctly: 100 NVDA bought at 200 is
-- 20,000 of the 100,000, and 220 at the close makes the portfolio 102,000.
select public.assert(
  (select final_value from public.portfolios p
   join public.weekly_cycles c on c.id = p.cycle_id
   where c.league_id is not null
     and p.user_id = 'aaaaaaaa-0000-0000-0000-000000000001') = 102000,
  'a battle is settled on its own closing prices'
);

-- ---------------------------------------------------------------------------
-- The house week still credits a career, exactly as it did
-- ---------------------------------------------------------------------------

do $$
declare
  house_id uuid := (
    select id from public.weekly_cycles where league_id is null limit 1
  );
begin
  perform public.execute_trade(
    'aaaaaaaa-0000-0000-0000-000000000001', house_id,
    'AAPL', 'buy', 100, 200, 10, 500, '2026-08-18'
  );

  perform public.score_cycle(house_id, '{"AAPL": 210, "SPY": 780}'::jsonb, 780);
end
$$;

select public.assert(
  (select weeks_played from public.profiles
   where id = 'aaaaaaaa-0000-0000-0000-000000000001') = 1,
  'the house week still counts towards a lifetime record'
);

select public.assert(
  (select count(*) from public.season_results) > 0,
  'and still enters the season'
);

-- ---------------------------------------------------------------------------
-- Shorts
-- ---------------------------------------------------------------------------
-- Opening one costs cash exactly as a purchase does. Closing one pays back
-- what was put in plus whatever the price has fallen since, and never less
-- than nothing.

select public.create_league(
  'bbbbbbbb-0000-0000-0000-000000000002', 'Downside', null, 3, 20
);

select public.create_battle(
  'bbbbbbbb-0000-0000-0000-000000000002',
  (select id from public.leagues where name = 'Downside'),
  'inverse', 'short', 'week',
  '2026-08-17', '2026-08-21', 100000, 'SH', 25.00
);

do $$
declare
  short_id uuid := (
    select c.id from public.weekly_cycles c
    join public.leagues l on l.id = c.league_id
    where l.name = 'Downside'
  );
begin
  -- Short 100 at 200: 20,000 of collateral, leaving 80,000 in cash.
  perform public.execute_trade(
    'bbbbbbbb-0000-0000-0000-000000000002', short_id,
    'TSLA', 'buy', 100, 200, 10, 500, '2026-08-18'
  );
end
$$;

select public.assert(
  (select cash from public.portfolios p
   join public.weekly_cycles c on c.id = p.cycle_id
   join public.leagues l on l.id = c.league_id
   where l.name = 'Downside') = 80000,
  'opening a short costs the same cash a purchase would'
);

do $$
declare
  short_id uuid := (
    select c.id from public.weekly_cycles c
    join public.leagues l on l.id = c.league_id
    where l.name = 'Downside'
  );
begin
  -- Cover half of it at 180. Half the stake is 10,000, and the price is down
  -- 20 a share on 50 shares, so 11,000 comes back.
  perform public.execute_trade(
    'bbbbbbbb-0000-0000-0000-000000000002', short_id,
    'TSLA', 'sell', 50, 180, 10, 500, '2026-08-19'
  );
end
$$;

select public.assert(
  (select cash from public.portfolios p
   join public.weekly_cycles c on c.id = p.cycle_id
   join public.leagues l on l.id = c.league_id
   where l.name = 'Downside') = 91000,
  'covering a short pays back the stake plus what the price has fallen'
);

-- And the log records the price it was covered at, not what the money did.
select public.assert(
  (select price from public.trades t
   join public.portfolios p on p.id = t.portfolio_id
   join public.weekly_cycles c on c.id = p.cycle_id
   join public.leagues l on l.id = c.league_id
   where l.name = 'Downside' and t.side = 'sell') = 180,
  'and the trade log still records the price that was actually seen'
);

do $$
declare
  short_id uuid := (
    select c.id from public.weekly_cycles c
    join public.leagues l on l.id = c.league_id
    where l.name = 'Downside'
  );
begin
  -- Settled with the remaining 50 shares at 150. The stake on them was
  -- 10,000 and the price is down 50 a share, so they are worth 12,500.
  perform public.score_cycle(short_id, '{"TSLA": 150, "SH": 26}'::jsonb, 26);
end
$$;

select public.assert(
  (select final_value from public.portfolios p
   join public.weekly_cycles c on c.id = p.cycle_id
   join public.leagues l on l.id = c.league_id
   where l.name = 'Downside') = 103500,
  'a short is settled as a short: it gains what the price lost'
);

-- ---------------------------------------------------------------------------
-- And a short can never cost more than was put into it
-- ---------------------------------------------------------------------------

select public.create_league(
  'cccccccc-0000-0000-0000-000000000003', 'Wipeout', null, 3, 20
);

select public.create_battle(
  'cccccccc-0000-0000-0000-000000000003',
  (select id from public.leagues where name = 'Wipeout'),
  'inverse', 'short', 'week',
  '2026-08-17', '2026-08-21', 100000, 'SH', 25.00
);

do $$
declare
  wipe_id uuid := (
    select c.id from public.weekly_cycles c
    join public.leagues l on l.id = c.league_id
    where l.name = 'Wipeout'
  );
begin
  perform public.execute_trade(
    'cccccccc-0000-0000-0000-000000000003', wipe_id,
    'GME', 'buy', 100, 100, 10, 500, '2026-08-18'
  );

  -- It quintupled. A real short would owe far more than the stake; here the
  -- position simply reaches nothing and stops.
  perform public.score_cycle(wipe_id, '{"GME": 500, "SH": 24}'::jsonb, 24);
end
$$;

select public.assert(
  (select final_value from public.portfolios p
   join public.weekly_cycles c on c.id = p.cycle_id
   join public.leagues l on l.id = c.league_id
   where l.name = 'Wipeout') = 90000,
  'a short that goes badly wrong costs the stake and not a cent more'
);

-- ---------------------------------------------------------------------------
-- Calling one off
-- ---------------------------------------------------------------------------

select public.create_battle(
  'aaaaaaaa-0000-0000-0000-000000000001',
  (select id from public.leagues where name = 'The Pit'),
  'one_shot', 'long', 'day',
  '2026-09-07', '2026-09-07', 100000, 'SPY', 780.00
);

do $$
declare
  battle_id uuid := (
    select c.id from public.weekly_cycles c
    join public.leagues l on l.id = c.league_id
    where l.name = 'The Pit' and c.status <> 'closed'
  );
begin
  -- Not the person who started it.
  begin
    perform public.cancel_battle('bbbbbbbb-0000-0000-0000-000000000002', battle_id);
    raise exception 'should not reach here';
  exception
    when others then
      perform public.assert(
        sqlerrm like '%only the person who started it%',
        'only whoever started a battle can call it off'
      );
  end;

  perform public.cancel_battle('aaaaaaaa-0000-0000-0000-000000000001', battle_id);
end
$$;

select public.assert(
  (select count(*) from public.weekly_cycles c
   join public.leagues l on l.id = c.league_id
   where l.name = 'The Pit' and c.status <> 'closed') = 0,
  'a cancelled battle is gone rather than shortened'
);

select public.create_battle(
  'aaaaaaaa-0000-0000-0000-000000000001',
  (select id from public.leagues where name = 'The Pit'),
  'silicon', 'long', 'year',
  '2026-09-08', '2027-09-03', 100000, 'SOXX', 200.00,
  'monthly'
);

select public.assert(
  (select cadence from public.weekly_cycles c
    join public.leagues l on l.id = c.league_id
    where l.name = 'The Pit' and c.status <> 'closed') = 'monthly',
  'a battle records the buying window it was started with'
);

select public.cancel_battle(
  'aaaaaaaa-0000-0000-0000-000000000001',
  (select c.id from public.weekly_cycles c
    join public.leagues l on l.id = c.league_id
    where l.name = 'The Pit' and c.status <> 'closed')
);

-- A settled one cannot be, which is what stops this being a way to throw away
-- a result somebody was losing.
do $$
declare
  settled_id uuid := (
    select c.id from public.weekly_cycles c
    join public.leagues l on l.id = c.league_id
    where l.name = 'Downside' and c.status = 'closed'
  );
begin
  perform public.cancel_battle('bbbbbbbb-0000-0000-0000-000000000002', settled_id);
  raise exception 'should not reach here';
exception
  when others then
    perform public.assert(
      sqlerrm like '%already finished%',
      'and a settled battle cannot be called off at all'
    );
end
$$;

-- The house week is not a battle and cannot be deleted through this door.
do $$
declare
  house_id uuid := (
    select id from public.weekly_cycles where league_id is null limit 1
  );
begin
  perform public.cancel_battle('aaaaaaaa-0000-0000-0000-000000000001', house_id);
  raise exception 'should not reach here';
exception
  when others then
    perform public.assert(
      sqlerrm like '%not a battle%',
      'and the house week cannot be cancelled by anybody'
    );
end
$$;

-- ---------------------------------------------------------------------------
-- due_cycles reads the recorded end date
-- ---------------------------------------------------------------------------
-- A fortnight and a year cannot be worked out from a Monday, which is why the
-- end date is on the row now rather than derived from it.

insert into public.weekly_cycles
  (monday, ends_on, status, starting_balance, benchmark_symbol, benchmark_open,
   league_id, format, direction, length)
values
  ('2026-06-01', '2026-08-28', 'open', 100000, 'SPY', 700,
   (select id from public.leagues where name = 'The Pit'), 'open', 'long', 'quarter');

select public.assert(
  not exists (
    select 1 from public.due_cycles('2026-08-25') where monday = '2026-06-01'
  ),
  'a quarter that started in June is not due in August because its Monday has passed'
);

select public.assert(
  exists (
    select 1 from public.due_cycles('2026-08-29') where monday = '2026-06-01'
  ),
  'and is due the day after the date it says it ends on'
);

\o
