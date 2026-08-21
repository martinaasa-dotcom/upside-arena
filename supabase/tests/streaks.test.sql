-- Tests for streaks, the weekly freeze, and cosmetic rewards.
--
-- The streak counts trading days. Weekends are not missed days, and a broken
-- streak must never touch standings or lifetime stats.

\set ON_ERROR_STOP on
\o /dev/null

insert into auth.users (id, email) values
  ('11112222-0000-0000-0000-000000000001', 'ivy@example.com'),
  ('33334444-0000-0000-0000-000000000002', 'jo@example.com');

-- ---------------------------------------------------------------------------
-- Counting up
-- ---------------------------------------------------------------------------

-- Monday.
select public.record_activity('11112222-0000-0000-0000-000000000001', '2026-08-17', 0, '2026-08-17');

select public.assert(
  (select current_streak from public.streaks
   where user_id = '11112222-0000-0000-0000-000000000001') = 1,
  'the first visit starts a streak at one'
);

select public.assert(
  (select freezes_available from public.streaks
   where user_id = '11112222-0000-0000-0000-000000000001') = 1,
  'a new player has their free weekly freeze'
);

-- Opening the app again the same day must not count twice.
select public.record_activity('11112222-0000-0000-0000-000000000001', '2026-08-17', 0, '2026-08-17');

select public.assert(
  (select current_streak from public.streaks
   where user_id = '11112222-0000-0000-0000-000000000001') = 1,
  'opening the app twice in a day counts once'
);

-- Tuesday, Wednesday, Thursday.
select public.record_activity('11112222-0000-0000-0000-000000000001', '2026-08-18', 0, '2026-08-17');
select public.record_activity('11112222-0000-0000-0000-000000000001', '2026-08-19', 0, '2026-08-17');
select public.record_activity('11112222-0000-0000-0000-000000000001', '2026-08-20', 0, '2026-08-17');

select public.assert(
  (select current_streak from public.streaks
   where user_id = '11112222-0000-0000-0000-000000000001') = 4,
  'consecutive trading days add up'
);

-- ---------------------------------------------------------------------------
-- The weekend is not a missed day
-- ---------------------------------------------------------------------------

-- Friday, then the following Monday. The app reports zero missed trading days
-- across the weekend, which is the whole point of counting trading days.
select public.record_activity('11112222-0000-0000-0000-000000000001', '2026-08-21', 0, '2026-08-17');
select public.record_activity('11112222-0000-0000-0000-000000000001', '2026-08-24', 0, '2026-08-24');

select public.assert(
  (select current_streak from public.streaks
   where user_id = '11112222-0000-0000-0000-000000000001') = 6,
  'a streak survives the weekend without spending anything'
);

select public.assert(
  (select freezes_used from public.streaks
   where user_id = '11112222-0000-0000-0000-000000000001') = 0,
  'no freeze is spent on a weekend'
);

-- ---------------------------------------------------------------------------
-- The free weekly freeze
-- ---------------------------------------------------------------------------

select public.assert(
  (select freeze_granted_week from public.streaks
   where user_id = '11112222-0000-0000-0000-000000000001') = '2026-08-24',
  'a new week grants the free freeze again'
);

-- Tuesday is skipped, and Wednesday the freeze covers it.
select public.record_activity('11112222-0000-0000-0000-000000000001', '2026-08-26', 1, '2026-08-24');

select public.assert(
  (select current_streak from public.streaks
   where user_id = '11112222-0000-0000-0000-000000000001') = 7,
  'a freeze carries the streak over a missed day'
);

select public.assert(
  (select freezes_available from public.streaks
   where user_id = '11112222-0000-0000-0000-000000000001') = 0,
  'the freeze is spent'
);

select public.assert(
  (select freezes_used from public.streaks
   where user_id = '11112222-0000-0000-0000-000000000001') = 1,
  'and the spend is recorded'
);

-- Thursday skipped too, and with no freeze left the streak goes.
select public.record_activity('11112222-0000-0000-0000-000000000001', '2026-08-28', 1, '2026-08-24');

select public.assert(
  (select current_streak from public.streaks
   where user_id = '11112222-0000-0000-0000-000000000001') = 1,
  'without a freeze a missed day breaks the streak'
);

select public.assert(
  (select longest_streak from public.streaks
   where user_id = '11112222-0000-0000-0000-000000000001') = 7,
  'the longest streak survives the break'
);

-- ---------------------------------------------------------------------------
-- Breaking a streak costs nothing else
-- ---------------------------------------------------------------------------
-- Section 2.3 is explicit: loss aversion stays pointed at the streak itself.

insert into public.weekly_cycles (monday, starting_balance, benchmark_open)
values ('2026-08-31', 100000, 800.00);

select public.ensure_portfolio(
  '11112222-0000-0000-0000-000000000001',
  (select id from public.weekly_cycles where monday = '2026-08-31'));

update public.profiles
set weeks_played = 4, best_week_return = 6.5, career_alpha_avg = 2.25
where id = '11112222-0000-0000-0000-000000000001';

-- Break it again, hard.
select public.record_activity('11112222-0000-0000-0000-000000000001', '2026-09-10', 5, '2026-09-07');

select public.assert(
  (select current_streak from public.streaks
   where user_id = '11112222-0000-0000-0000-000000000001') = 1,
  'a long absence resets the streak'
);

select public.assert(
  (select weeks_played = 4 and best_week_return = 6.5 and career_alpha_avg = 2.25
   from public.profiles where id = '11112222-0000-0000-0000-000000000001'),
  'breaking a streak leaves the lifetime record untouched'
);

select public.assert(
  (select count(*) from public.portfolios
   where user_id = '11112222-0000-0000-0000-000000000001') = 1,
  'breaking a streak leaves the portfolio untouched'
);

-- ---------------------------------------------------------------------------
-- Milestones
-- ---------------------------------------------------------------------------

do $$
declare
  day date := '2026-10-05';
  i integer;
begin
  for i in 1..10 loop
    perform public.record_activity(
      '33334444-0000-0000-0000-000000000002', day, 0, date_trunc('week', day)::date);
    day := day + 1;
    -- Skip the weekend, the way the app would.
    if extract(dow from day) = 6 then day := day + 2; end if;
  end loop;
end $$;

select public.assert(
  (select current_streak from public.streaks
   where user_id = '33334444-0000-0000-0000-000000000002') = 10,
  'ten trading days in a row counts as ten'
);

select public.assert(
  (select count(*) from public.user_rewards
   where user_id = '33334444-0000-0000-0000-000000000002'
     and reward_id in ('title.full_week', 'title.two_weeks')) = 2,
  'passing a milestone hands over the title'
);

select public.assert(
  (select count(*) from public.user_rewards
   where user_id = '33334444-0000-0000-0000-000000000002'
     and reward_id = 'title.a_month') = 0,
  'a milestone not yet reached is not handed over'
);

-- Running it again must not duplicate anything.
select public.record_activity('33334444-0000-0000-0000-000000000002', '2026-10-16', 0, '2026-10-12');

select public.assert(
  (select count(*) from public.user_rewards
   where user_id = '33334444-0000-0000-0000-000000000002') = 2,
  'a title is only ever handed over once'
);

-- ---------------------------------------------------------------------------
-- Wearing a title
-- ---------------------------------------------------------------------------

select public.equip_title('33334444-0000-0000-0000-000000000002', 'title.full_week');

select public.assert(
  (select equipped_title from public.profiles
   where id = '33334444-0000-0000-0000-000000000002') = 'title.full_week',
  'a player can wear a title they earned'
);

do $$
begin
  begin
    perform public.equip_title('33334444-0000-0000-0000-000000000002', 'title.two_months');
    raise exception 'FAILED: a player wore a title they had not earned';
  exception when others then
    if sqlerrm like '%not earned%' then
      raise notice 'ok: a title has to be earned before it can be worn';
    else raise; end if;
  end;
end $$;

-- Straight at the profile row, bypassing the function entirely.
do $$
begin
  begin
    update public.profiles
    set equipped_title = 'title.two_months'
    where id = '33334444-0000-0000-0000-000000000002';
    raise exception 'FAILED: an unearned title was written straight to the profile';
  exception when others then
    if sqlerrm like '%not earned%' then
      raise notice 'ok: an unearned title cannot be written to the profile either';
    else raise; end if;
  end;
end $$;

select public.equip_title('33334444-0000-0000-0000-000000000002', null);

select public.assert(
  (select equipped_title is null from public.profiles
   where id = '33334444-0000-0000-0000-000000000002'),
  'a player can take a title off again'
);

-- ---------------------------------------------------------------------------
-- Nothing here is writable by a player
-- ---------------------------------------------------------------------------

do $$
begin
  perform set_config('request.jwt.claims',
    '{"sub": "33334444-0000-0000-0000-000000000002"}', true);
  set local role authenticated;

  begin
    update public.streaks set current_streak = 999
    where user_id = '33334444-0000-0000-0000-000000000002';
    if found then raise exception 'FAILED: a player set their own streak'; end if;
    raise notice 'ok: a player cannot set their own streak';
  exception when insufficient_privilege then
    raise notice 'ok: a player cannot set their own streak';
  end;

  begin
    insert into public.user_rewards (user_id, reward_id)
    values ('33334444-0000-0000-0000-000000000002', 'title.two_months');
    raise exception 'FAILED: a player granted themselves a title';
  exception when insufficient_privilege then
    raise notice 'ok: a player cannot grant themselves a title';
  end;

  begin
    perform public.record_activity(
      '33334444-0000-0000-0000-000000000002', '2026-10-19', 0, '2026-10-19');
    raise exception 'FAILED: a player called record_activity directly';
  exception when insufficient_privilege then
    raise notice 'ok: a player cannot call record_activity directly';
  end;
end $$;

begin;
  set local request.jwt.claims = '{"sub": "33334444-0000-0000-0000-000000000002"}';
  set local role authenticated;

  select public.assert(
    (select count(*) from public.rewards) > 0,
    'the catalogue of what can be earned is readable'
  );

  select public.assert(
    (select count(*) from public.streaks) = 1,
    'a player reads their own streak and nobody else''s'
  );
commit;

-- ---------------------------------------------------------------------------
-- Closing an account
-- ---------------------------------------------------------------------------

delete from auth.users where id = '33334444-0000-0000-0000-000000000002';

select public.assert(
  (select count(*) from public.streaks
   where user_id = '33334444-0000-0000-0000-000000000002') = 0,
  'closing an account erases the streak'
);

select public.assert(
  (select count(*) from public.user_rewards
   where user_id = '33334444-0000-0000-0000-000000000002') = 0,
  'closing an account erases the rewards earned'
);
