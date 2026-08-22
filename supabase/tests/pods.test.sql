-- Tests for the matchmade pods of section 2.2: which rung somebody lands on,
-- how pods fill, and what a finished week does to where they are next week.

\set ON_ERROR_STOP on
\o /dev/null

-- ---------------------------------------------------------------------------
-- The ladder
-- ---------------------------------------------------------------------------

select public.assert(
  public.tier_for_rating(1000) = 'bronze',
  'a new player at the default rating starts in bronze'
);

select public.assert(
  public.tier_for_rating(1099) = 'bronze' and public.tier_for_rating(1100) = 'silver',
  'the bands meet exactly, with no rating falling between two rungs'
);

select public.assert(
  public.tier_for_rating(1300) = 'gold' and public.tier_for_rating(1500) = 'diamond',
  'and carry on up to diamond'
);

select public.assert(
  public.tier_for_rating(0) = 'bronze' and public.tier_for_rating(-50) = 'bronze',
  'a rating at or below the floor is still on the ladder, not off it'
);

select public.assert(
  public.tier_for_rating(999999) = 'diamond',
  'and one above the top rung stays on the top rung'
);

-- ---------------------------------------------------------------------------
-- Placement
-- ---------------------------------------------------------------------------

insert into public.weekly_cycles (monday, starting_balance, benchmark_open)
values ('2026-08-17', 100000, 800.00);

do $$
declare
  i integer;
begin
  for i in 1..30 loop
    insert into auth.users (id, email, raw_user_meta_data)
    values (
      ('aaaaaaaa-0000-0000-0000-' || lpad(i::text, 12, '0'))::uuid,
      'p' || i || '@example.com',
      '{}'::jsonb
    );
  end loop;
end;
$$;

select public.assert(
  (public.place_in_pod(
     'aaaaaaaa-0000-0000-0000-000000000001',
     (select id from public.weekly_cycles where monday = '2026-08-17'))).tier = 'bronze',
  'a new player is placed on the rung their rating puts them on'
);

select public.assert(
  (select count(*) from public.pods) = 1,
  'and the first one to arrive causes a pod to be made'
);

-- Called on every visit, so this is the case that matters most.
select public.assert(
  (public.place_in_pod(
     'aaaaaaaa-0000-0000-0000-000000000001',
     (select id from public.weekly_cycles where monday = '2026-08-17'))).id
  = (select id from public.pods limit 1),
  'asking again returns the pod they are already in'
);

select public.assert(
  (select count(*) from public.pod_members) = 1,
  'and does not seat them twice'
);

-- Fill past one pod's target and a second has to open.
do $$
declare
  i integer;
  cycle uuid := (select id from public.weekly_cycles where monday = '2026-08-17');
begin
  for i in 2..30 loop
    perform public.place_in_pod(
      ('aaaaaaaa-0000-0000-0000-' || lpad(i::text, 12, '0'))::uuid, cycle);
  end loop;
end;
$$;

select public.assert(
  (select count(*) from public.pods) = 2,
  'past the target size a second pod opens rather than one growing forever'
);

select public.assert(
  (select count(*) from public.pod_members m
   join public.pods p on p.id = m.pod_id where p.number = 1) = 24,
  'the first pod fills to the target and stops'
);

select public.assert(
  (select count(*) from public.pod_members) = 30,
  'and everybody who asked has a seat'
);

-- Section 2.2: bucket by rating. Somebody rated up is not in with beginners.
update public.profiles set rating = 1600
where id = 'aaaaaaaa-0000-0000-0000-000000000030';

insert into public.weekly_cycles (monday, starting_balance, benchmark_open)
values ('2026-08-24', 100000, 810.00);

select public.assert(
  (public.place_in_pod(
     'aaaaaaaa-0000-0000-0000-000000000030',
     (select id from public.weekly_cycles where monday = '2026-08-24'))).tier = 'diamond',
  'a rating that has climbed puts somebody on a higher rung the next week'
);

select public.assert(
  (public.place_in_pod(
     'aaaaaaaa-0000-0000-0000-000000000001',
     (select id from public.weekly_cycles where monday = '2026-08-24'))).tier = 'bronze',
  'and everybody is placed again rather than staying where they were'
);

-- ---------------------------------------------------------------------------
-- Settling a week
-- ---------------------------------------------------------------------------

-- Give the first pod a scored week to be ranked on.
do $$
declare
  m record;
  n integer := 0;
  cycle uuid := (select id from public.weekly_cycles where monday = '2026-08-17');
begin
  for m in
    select pm.user_id from public.pod_members pm
    join public.pods p on p.id = pm.pod_id
    where p.number = 1 and p.cycle_id = cycle
    order by pm.joined_at
  loop
    n := n + 1;
    perform public.ensure_portfolio(m.user_id, cycle);
    -- A clean spread, best first, so the ordering is unambiguous.
    update public.portfolios
    set return_percent = (30 - n), benchmark_diff = (30 - n)
    where user_id = m.user_id and cycle_id = cycle;
  end loop;
end;
$$;

select public.assert(
  (select count(*) from public.due_pods()) = 0,
  'a pod whose week is still running is not due'
);

update public.weekly_cycles set status = 'closed' where monday = '2026-08-17';

select public.assert(
  (select count(*) from public.due_pods()) = 2,
  'and both are due once the week is closed'
);

select public.assert(
  public.settle_pod(
    (select id from public.pods where number = 1
     and cycle_id = (select id from public.weekly_cycles where monday = '2026-08-17'))) = 24,
  'settling ranks everybody in the pod'
);

select public.assert(
  (select outcome from public.pod_members m
   join public.pods p on p.id = m.pod_id
   where p.number = 1 and m.final_rank = 1) = 'promoted',
  'the best week in the pod goes up'
);

select public.assert(
  (select outcome from public.pod_members m
   join public.pods p on p.id = m.pod_id
   where p.number = 1 and m.final_rank = 24) = 'relegated',
  'and the worst goes down'
);

select public.assert(
  (select outcome from public.pod_members m
   join public.pods p on p.id = m.pod_id
   where p.number = 1 and m.final_rank = 12) = 'held',
  'while the middle of the table stays where it is'
);

select public.assert(
  (select count(*) from public.pod_members m
   join public.pods p on p.id = m.pod_id
   where p.number = 1 and m.outcome = 'promoted') = 4,
  'a fifth of a pod of twenty four goes up'
);

select public.assert(
  (select count(*) from public.pod_members m
   join public.pods p on p.id = m.pod_id
   where p.number = 1 and m.outcome = 'relegated') = 4,
  'and the same number goes down, so the ladder stays the same shape'
);

select public.assert(
  (select rating from public.profiles p
   join public.pod_members m on m.user_id = p.id
   join public.pods pd on pd.id = m.pod_id
   where pd.number = 1 and m.final_rank = 1) = 1060,
  'going up moves the rating that decides next week'
);

select public.assert(
  (select rating from public.profiles p
   join public.pod_members m on m.user_id = p.id
   join public.pods pd on pd.id = m.pod_id
   where pd.number = 1 and m.final_rank = 24) = 940,
  'and going down moves it the other way'
);

-- A settler that crashes will come back, and must not promote anybody twice.
select public.assert(
  public.settle_pod(
    (select id from public.pods where number = 1
     and cycle_id = (select id from public.weekly_cycles where monday = '2026-08-17'))) = 0,
  'settling a settled pod does nothing at all'
);

select public.assert(
  (select rating from public.profiles p
   join public.pod_members m on m.user_id = p.id
   join public.pods pd on pd.id = m.pod_id
   where pd.number = 1 and m.final_rank = 1) = 1060,
  'and does not move a rating a second time'
);

select public.assert(
  (select count(*) from public.due_pods()) = 1,
  'a settled pod is no longer due'
);

-- ---------------------------------------------------------------------------
-- A pod too small to be a ladder
-- ---------------------------------------------------------------------------
-- Section 2.2 warns that thin pods are the failure mode of this whole idea.
-- Relegating one of six people is a coin toss with a demotion attached.

select public.assert(
  public.settle_pod(
    (select id from public.pods where number = 2
     and cycle_id = (select id from public.weekly_cycles where monday = '2026-08-17'))) = 6,
  'a small pod is still ranked'
);

select public.assert(
  (select count(*) from public.pod_members m
   join public.pods p on p.id = m.pod_id
   where p.number = 2 and m.outcome <> 'held') = 0,
  'but nobody is moved up or down out of one'
);

select public.assert(
  (select count(*) from public.pod_members m
   join public.pods p on p.id = m.pod_id
   where p.number = 2 and coalesce(m.rating_change, 0) <> 0) = 0,
  'and no rating moves either'
);

-- ---------------------------------------------------------------------------
-- What a player may do
-- ---------------------------------------------------------------------------

do $$
begin
  perform set_config('request.jwt.claims',
    '{"sub": "aaaaaaaa-0000-0000-0000-000000000001"}', true);
  set local role authenticated;

  begin
    update public.pod_members set outcome = 'promoted', rating_change = 500
    where user_id = 'aaaaaaaa-0000-0000-0000-000000000001';
    if found then raise exception 'FAILED: a player promoted themselves'; end if;
    raise notice 'ok: a player cannot promote themselves';
  exception when insufficient_privilege then
    raise notice 'ok: a player cannot promote themselves';
  end;

  begin
    perform public.place_in_pod(
      'aaaaaaaa-0000-0000-0000-000000000001',
      (select id from public.weekly_cycles where monday = '2026-08-17'));
    raise exception 'FAILED: a player placed themselves in a pod';
  exception when insufficient_privilege then
    raise notice 'ok: a player cannot place themselves in a pod';
  end;

  begin
    perform public.settle_pod((select id from public.pods limit 1));
    raise exception 'FAILED: a player settled a pod';
  exception when insufficient_privilege then
    raise notice 'ok: a player cannot settle a pod';
  end;

  if (select count(*) from public.pod_members) = 0 then
    raise exception 'FAILED: a player cannot see the pod standings';
  end if;
  raise notice 'ok: a player can read the pod standings, the same as a league table';
end $$;
