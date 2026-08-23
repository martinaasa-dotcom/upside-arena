-- Tests for the four numbers section 2.8 says the loop is tuned by.
--
-- A metric that is quietly wrong is worse than one that is missing: it gets
-- believed and then acted on. Most of what follows is about the ways each of
-- these flatters or slanders the product if the arithmetic slips.

\set ON_ERROR_STOP on
\o /dev/null

/*
  Every date in this file means today in New York.

  That is what the metrics functions are asked about -- getMetrics passes
  nyDate() -- and what record_daily_active is given when the app records a
  visit. Postgres's current_date is the server's, which in CI and in
  production is UTC, and between midnight in London and midnight in New York
  those are two different days.

  Which is a four hour window in which this file failed on arithmetic that
  was perfectly correct: Priya joins "today", her cohort is dated in New York
  where it is still yesterday, and metrics_retention is then asked about a
  UTC today that is already tomorrow, so a player who joined seconds ago is
  counted as having had a day to come back in.

  Setting the session's timezone rather than rewriting two dozen call sites
  makes current_date mean the same thing here as nyDate() means in the app,
  which is the thing the file was always assuming it meant. Each suite gets
  its own psql session and its own database, so this reaches nothing else.
*/
set timezone = 'America/New_York';

insert into auth.users (id, email) values
  ('aaaa1111-0000-0000-0000-000000000001', 'nina@example.com'),
  ('bbbb2222-0000-0000-0000-000000000002', 'omar@example.com'),
  ('cccc3333-0000-0000-0000-000000000003', 'priya@example.com');

-- Nina and Omar joined forty days ago. Priya joined today.
update public.profiles set created_at = now() - interval '40 days'
  where id in ('aaaa1111-0000-0000-0000-000000000001',
               'bbbb2222-0000-0000-0000-000000000002');
update public.profiles set created_at = now() where id = 'cccc3333-0000-0000-0000-000000000003';

-- ---------------------------------------------------------------------------
-- Retention
-- ---------------------------------------------------------------------------

create temporary table joined_on as
  select id, (created_at at time zone 'America/New_York')::date as day
  from public.profiles;

-- Nina came back the next day and again a month later. Omar never came back.
select public.record_daily_active(
  'aaaa1111-0000-0000-0000-000000000001',
  (select day from joined_on where id = 'aaaa1111-0000-0000-0000-000000000001') + 1);
select public.record_daily_active(
  'aaaa1111-0000-0000-0000-000000000001',
  (select day from joined_on where id = 'aaaa1111-0000-0000-0000-000000000001') + 25);

-- The day they joined is not coming back, and must not count as it.
select public.record_daily_active(
  'bbbb2222-0000-0000-0000-000000000002',
  (select day from joined_on where id = 'bbbb2222-0000-0000-0000-000000000002'));

select public.assert(
  (select cohort from public.metrics_retention(current_date) where window_days = 1) = 2,
  'only cohorts old enough to have come back are counted'
);

select public.assert(
  (select returned from public.metrics_retention(current_date) where window_days = 1) = 1,
  'coming back the next day counts as day one retention'
);

select public.assert(
  (select returned from public.metrics_retention(current_date) where window_days = 7) = 1,
  'a visit inside the first day is inside the first week too'
);

select public.assert(
  (select returned from public.metrics_retention(current_date) where window_days = 30) = 1,
  'and a player is counted once however many times they came back'
);

select public.assert(
  (select count(*) from public.metrics_retention(current_date)) = 3,
  'all three windows are reported'
);

/*
  Priya joined today, so she cannot have come back yet. Counting her would
  report retention as far worse than it is, which is the classic way this
  number gets read as a crisis.
*/
select public.assert(
  (select cohort from public.metrics_retention(current_date) where window_days = 30) = 2,
  'somebody who joined today is not counted against a thirty day figure'
);

-- ---------------------------------------------------------------------------
-- Being counted as active
-- ---------------------------------------------------------------------------

select public.record_daily_active('cccc3333-0000-0000-0000-000000000003', current_date);
select public.record_daily_active('cccc3333-0000-0000-0000-000000000003', current_date);

select public.assert(
  (select count(*) from public.daily_actives
   where user_id = 'cccc3333-0000-0000-0000-000000000003') = 1,
  'opening the app twice in a day is one active day, not two'
);

-- ---------------------------------------------------------------------------
-- Streak survival
-- ---------------------------------------------------------------------------

select public.record_activity('aaaa1111-0000-0000-0000-000000000001', '2026-08-17', 0, '2026-08-17');
select public.record_activity('aaaa1111-0000-0000-0000-000000000001', '2026-08-18', 0, '2026-08-17');
select public.record_activity('aaaa1111-0000-0000-0000-000000000001', '2026-08-19', 0, '2026-08-17');
select public.record_activity('aaaa1111-0000-0000-0000-000000000001', '2026-08-20', 0, '2026-08-17');
select public.record_activity('aaaa1111-0000-0000-0000-000000000001', '2026-08-21', 0, '2026-08-17');

/*
  Omar missed a day, spent his freeze to cover it, then missed another with
  nothing left and lost the streak. Both halves matter: the freeze is what
  this metric exists to watch, because a mechanic that everybody survives only
  by spending freezes is not a streak mechanic.
*/
select public.record_activity('bbbb2222-0000-0000-0000-000000000002', '2026-08-17', 0, '2026-08-17');
select public.record_activity('bbbb2222-0000-0000-0000-000000000002', '2026-08-19', 1, '2026-08-17');
select public.record_activity('bbbb2222-0000-0000-0000-000000000002', '2026-08-21', 1, '2026-08-17');

select public.assert(
  (select players from public.metrics_streaks()) = 2,
  'everyone who has ever had a streak is counted'
);

select public.assert(
  (select reached_five from public.metrics_streaks()) = 1,
  'getting through a full week is counted from the longest, not the current'
);

select public.assert(
  (select alive from public.metrics_streaks()) = 2,
  'a streak that broke and restarted is still a live streak'
);

select public.assert(
  (select reached_twenty from public.metrics_streaks()) = 0,
  'a milestone nobody has reached reports zero rather than nothing'
);

select public.assert(
  (select longest from public.metrics_streaks()) = 5,
  'the best streak anyone has managed is reported'
);

select public.assert(
  (select freezes_spent from public.metrics_streaks()) = 1,
  'freezes spent are counted, so it is visible when they are what carried people'
);

-- ---------------------------------------------------------------------------
-- How full the leagues get
-- ---------------------------------------------------------------------------

select public.create_league('aaaa1111-0000-0000-0000-000000000001', 'Friday Club', null);
select public.create_league('bbbb2222-0000-0000-0000-000000000002', 'Just me', null);

select public.join_league(
  'cccc3333-0000-0000-0000-000000000003',
  (select invite_code from public.leagues where name = 'Friday Club'));

select public.assert(
  (select leagues from public.metrics_leagues()) = 2,
  'every league is counted'
);

/*
  The single most useful failure Arena can see: somebody made a league and
  nobody joined it. If that number is large, the invite is broken, not the
  game.
*/
select public.assert(
  (select alone from public.metrics_leagues()) = 1,
  'a league of one is counted separately, because it is a failed invite'
);

select public.assert(
  (select with_company from public.metrics_leagues()) = 1,
  'and a league that actually filled is counted separately too'
);

select public.assert(
  (select biggest from public.metrics_leagues()) = 2,
  'the fullest league is reported'
);

-- ---------------------------------------------------------------------------
-- The funnel and the share rate
-- ---------------------------------------------------------------------------

update public.profiles set onboarded_at = now()
  where id in ('aaaa1111-0000-0000-0000-000000000001',
               'bbbb2222-0000-0000-0000-000000000002');

select public.ensure_cycle('2026-08-17', 100000, 500);
select public.ensure_portfolio('aaaa1111-0000-0000-0000-000000000001',
  (select id from public.weekly_cycles where monday = '2026-08-17'));
select public.ensure_portfolio('bbbb2222-0000-0000-0000-000000000002',
  (select id from public.weekly_cycles where monday = '2026-08-17'));

-- Nina traded twice. One person who trades, not two trades.
select public.execute_trade('aaaa1111-0000-0000-0000-000000000001',
  (select id from public.weekly_cycles where monday = '2026-08-17'),
  'AAPL', 'buy', 10, 100);
select public.execute_trade('aaaa1111-0000-0000-0000-000000000001',
  (select id from public.weekly_cycles where monday = '2026-08-17'),
  'MSFT', 'buy', 5, 200);

select public.assert(
  (select traded from public.metrics_engagement(current_date)) = 1,
  'the funnel counts people who traded, not trades'
);

select public.assert(
  (select onboarded from public.metrics_engagement(current_date)) = 2,
  'and people who finished setting up'
);

select public.assert(
  (select in_a_league from public.metrics_engagement(current_date)) = 3,
  'and people who are in any league at all'
);

select public.assert(
  (select players from public.metrics_engagement(current_date)) = 3,
  'against everyone who has an account'
);

-- Both weeks scored; only Nina shared hers.
update public.portfolios set return_percent = 4.2, benchmark_diff = 1.0;

select public.create_share_card(
  'aaaa1111-0000-0000-0000-000000000001',
  (select id from public.weekly_cycles where monday = '2026-08-17'),
  '2026-08-17', 'Nina', null, 4.2, 3.2, 1.0, null, null, null, 5, '[]'::jsonb);

select public.assert(
  (select weeks_scored from public.metrics_engagement(current_date)) = 2,
  'the share rate is measured against weeks that were actually scored'
);

/*
  A battle is not a week.

  weeks_scored is the only number on the numbers page that says how much of
  this game has actually been played, and the retention story is read off it.
  Counting every scored portfolio -- which is what it used to do -- means a
  league running a one-day battle every day of a fortnight adds ten weeks that
  nobody played, in the right direction, plausibly, unnoticed.
*/
do $$
declare
  battle_id uuid;
begin
  perform public.create_league(
    'aaaa1111-0000-0000-0000-000000000001', 'Side show', null, 3, 20
  );

  select id into battle_id from public.create_battle(
    'aaaa1111-0000-0000-0000-000000000001',
    (select id from public.leagues where name = 'Side show'),
    'one_shot', 'long', 'day',
    current_date, current_date, 100000, 'SPY', 700
  );

  perform public.ensure_portfolio('aaaa1111-0000-0000-0000-000000000001', battle_id);
  perform public.score_cycle(battle_id, '{"SPY": 710}'::jsonb, 710);
end
$$;

select public.assert(
  (select weeks_scored from public.metrics_engagement(current_date)) = 2,
  'a settled battle is not counted among the weeks that were played'
);

select public.assert(
  (select battles_settled from public.metrics_engagement(current_date)) = 1
    and (select leagues_with_a_battle from public.metrics_engagement(current_date)) = 1,
  'it is counted as what it is instead'
);

select public.assert(
  (select weeks_shared from public.metrics_engagement(current_date)) = 1,
  'and against the weeks that were shared'
);

select public.assert(
  (select active_today from public.metrics_engagement(current_date)) = 1,
  'today''s actives are counted'
);

-- A card taken down was still shared once. Both are worth knowing apart.
select public.revoke_share_card(
  'aaaa1111-0000-0000-0000-000000000001',
  (select id from public.share_cards limit 1));

select public.assert(
  (select weeks_shared from public.metrics_engagement(current_date)) = 1,
  'taking a card down does not erase the fact that it was shared'
);

select public.assert(
  (select cards_live from public.metrics_engagement(current_date)) = 0,
  'but it is no longer counted as live'
);

-- ---------------------------------------------------------------------------
-- Nobody but the service role touches any of this
-- ---------------------------------------------------------------------------
-- Every one of these functions reads every player's rows, which is exactly
-- why no client role may call them.

do $$
begin
  begin
    perform set_config('request.jwt.claims',
      '{"sub": "aaaa1111-0000-0000-0000-000000000001"}', true);
    perform set_config('role', 'authenticated', true);
    perform * from public.metrics_engagement(current_date);
    raise exception 'FAILED: a player read the engagement metrics';
  exception when insufficient_privilege then
    raise notice 'ok: a player cannot read the engagement metrics';
  end;

  begin
    perform set_config('request.jwt.claims',
      '{"sub": "aaaa1111-0000-0000-0000-000000000001"}', true);
    perform set_config('role', 'authenticated', true);
    perform * from public.metrics_retention(current_date);
    raise exception 'FAILED: a player read the retention metrics';
  exception when insufficient_privilege then
    raise notice 'ok: a player cannot read the retention metrics';
  end;

  begin
    perform set_config('request.jwt.claims',
      '{"sub": "aaaa1111-0000-0000-0000-000000000001"}', true);
    perform set_config('role', 'authenticated', true);
    perform public.record_daily_active('bbbb2222-0000-0000-0000-000000000002', current_date);
    raise exception 'FAILED: a player recorded somebody else as active';
  exception when insufficient_privilege then
    raise notice 'ok: a player cannot record anybody as active, including themselves';
  end;
end $$;

begin;
  set local request.jwt.claims = '{"sub": "aaaa1111-0000-0000-0000-000000000001"}';
  set local role authenticated;

  select public.assert(
    (select count(*) from public.daily_actives) = 2,
    'a player sees their own visits and nobody else''s'
  );
commit;

-- ---------------------------------------------------------------------------
-- Closing an account
-- ---------------------------------------------------------------------------

delete from auth.users where id = 'aaaa1111-0000-0000-0000-000000000001';

select public.assert(
  (select count(*) from public.daily_actives
   where user_id = 'aaaa1111-0000-0000-0000-000000000001') = 0,
  'closing an account takes its visit history with it'
);
