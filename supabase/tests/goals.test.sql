-- Tests for the declared weekly goal of section 3.8: who may declare one, who
-- may see it, and that it cannot be quietly rewritten once the week is known.

\set ON_ERROR_STOP on
\o /dev/null

insert into auth.users (id, email, raw_user_meta_data)
values
  ('9a000000-0000-0000-0000-000000000001', 'ann@example.com', '{}'::jsonb),
  ('9b000000-0000-0000-0000-000000000002', 'ben@example.com', '{}'::jsonb),
  ('9c000000-0000-0000-0000-000000000003', 'cal@example.com', '{}'::jsonb);

insert into public.weekly_cycles (monday, starting_balance, benchmark_open)
values ('2026-08-17', 100000, 800.00);

select public.create_league(
  '9a000000-0000-0000-0000-000000000001', 'The office', null, 3, 20);

select public.join_league(
  '9b000000-0000-0000-0000-000000000002',
  (select invite_code from public.leagues where name = 'The office'),
  10);

-- ---------------------------------------------------------------------------
-- Declaring
-- ---------------------------------------------------------------------------

select public.assert(
  (public.declare_goal(
    '9a000000-0000-0000-0000-000000000001',
    (select id from public.leagues where name = 'The office'),
    (select id from public.weekly_cycles where monday = '2026-08-17'),
    'beat_market')).kind = 'beat_market',
  'a member declares a goal to their league'
);

-- The mechanic depends on this. A goal that can be swapped on Friday once the
-- week is known is a scoreboard drawn afterwards, not a commitment.
do $$
begin
  begin
    perform public.declare_goal(
      '9a000000-0000-0000-0000-000000000001',
      (select id from public.leagues where name = 'The office'),
      (select id from public.weekly_cycles where monday = '2026-08-17'),
      'finish_up');
    raise exception 'FAILED: a goal was changed after it was declared';
  exception when others then
    if sqlerrm like '%already declared%' then
      raise notice 'ok: a goal cannot be swapped once it is declared';
    else
      raise;
    end if;
  end;
end;
$$;

do $$
begin
  begin
    perform public.declare_goal(
      '9c000000-0000-0000-0000-000000000003',
      (select id from public.leagues where name = 'The office'),
      (select id from public.weekly_cycles where monday = '2026-08-17'),
      'beat_market');
    raise exception 'FAILED: an outsider declared a goal to a league';
  exception when others then
    if sqlerrm like '%not a member%' then
      raise notice 'ok: somebody outside the league cannot declare a goal to it';
    else
      raise;
    end if;
  end;
end;
$$;

do $$
begin
  begin
    perform public.declare_goal(
      '9b000000-0000-0000-0000-000000000002',
      (select id from public.leagues where name = 'The office'),
      (select id from public.weekly_cycles where monday = '2026-08-17'),
      'get_rich_quick');
    raise exception 'FAILED: an invented goal kind was accepted';
  exception when check_violation then
    raise notice 'ok: a goal has to be one of the ones offered';
  end;
end;
$$;

select public.assert(
  (public.declare_goal(
    '9b000000-0000-0000-0000-000000000002',
    (select id from public.leagues where name = 'The office'),
    (select id from public.weekly_cycles where monday = '2026-08-17'),
    'every_day')).kind = 'every_day',
  'another member declares a different goal for the same week'
);

-- ---------------------------------------------------------------------------
-- Who sees it
-- ---------------------------------------------------------------------------

do $$
begin
  perform set_config('request.jwt.claims',
    '{"sub": "9b000000-0000-0000-0000-000000000002"}', true);
  set local role authenticated;

  if (select count(*) from public.weekly_goals) <> 2 then
    raise exception 'FAILED: a member cannot see the goals declared to their league';
  end if;
  raise notice 'ok: a member sees every goal declared to their league';
end $$;

do $$
begin
  perform set_config('request.jwt.claims',
    '{"sub": "9c000000-0000-0000-0000-000000000003"}', true);
  set local role authenticated;

  -- Declaring something in front of four people is not publishing it, and
  -- that difference is the whole reason the mechanic works.
  if (select count(*) from public.weekly_goals) <> 0 then
    raise exception 'FAILED: somebody outside the league read its goals';
  end if;
  raise notice 'ok: somebody outside the league sees none of them';
end $$;

-- ---------------------------------------------------------------------------
-- What a player may do directly
-- ---------------------------------------------------------------------------

do $$
begin
  perform set_config('request.jwt.claims',
    '{"sub": "9a000000-0000-0000-0000-000000000001"}', true);
  set local role authenticated;

  begin
    update public.weekly_goals set kind = 'finish_up'
    where user_id = '9a000000-0000-0000-0000-000000000001';
    if found then
      raise exception 'FAILED: a player rewrote their own declared goal';
    end if;
    raise notice 'ok: a player cannot rewrite their own declared goal';
  exception when insufficient_privilege then
    raise notice 'ok: a player cannot rewrite their own declared goal';
  end;

  begin
    insert into public.weekly_goals (user_id, league_id, cycle_id, kind)
    values (
      '9a000000-0000-0000-0000-000000000001',
      (select id from public.leagues where name = 'The office'),
      (select id from public.weekly_cycles where monday = '2026-08-17'),
      'top_three');
    raise exception 'FAILED: a player wrote a goal row directly';
  exception when insufficient_privilege then
    raise notice 'ok: a player cannot write a goal row directly';
  end;

  begin
    perform public.declare_goal(
      '9a000000-0000-0000-0000-000000000001',
      (select id from public.leagues where name = 'The office'),
      (select id from public.weekly_cycles where monday = '2026-08-17'),
      'top_three');
    raise exception 'FAILED: a player called declare_goal directly';
  exception when insufficient_privilege then
    raise notice 'ok: a player cannot call declare_goal directly';
  end;

  -- The one thing they may do, because it can only ever take something away
  -- from them. Holding somebody to a promise they want out of is a trap.
  delete from public.weekly_goals
  where user_id = '9a000000-0000-0000-0000-000000000001';

  if (select count(*) from public.weekly_goals) <> 1 then
    raise exception 'FAILED: a player could not withdraw their own goal';
  end if;
  raise notice 'ok: a player can withdraw their own goal';

  begin
    delete from public.weekly_goals
    where user_id = '9b000000-0000-0000-0000-000000000002';
    if found then
      raise exception 'FAILED: a player withdrew somebody else''s goal';
    end if;
    raise notice 'ok: a player cannot withdraw somebody else''s goal';
  exception when insufficient_privilege then
    raise notice 'ok: a player cannot withdraw somebody else''s goal';
  end;
end $$;

-- ---------------------------------------------------------------------------
-- Leaving takes the goal with it
-- ---------------------------------------------------------------------------

select public.leave_league(
  '9b000000-0000-0000-0000-000000000002',
  (select id from public.leagues where name = 'The office'));

select public.assert(
  (select count(*) from public.weekly_goals) = 1,
  'leaving a league leaves the goal declared to it, because it was said'
);

delete from auth.users where id = '9b000000-0000-0000-0000-000000000002';

select public.assert(
  (select count(*) from public.weekly_goals) = 0,
  'but closing an account erases it, the same as everything else'
);
