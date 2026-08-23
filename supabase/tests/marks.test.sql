-- Tests for what still needs recording, now that a week is not the only
-- contest that has closes worth keeping.
--
-- A mark cannot be worked out afterwards. Prices move on, so a day a contest
-- was not recorded is a day of its shape that is gone for good -- which makes
-- the question "is there anything left to do today" one it is expensive to
-- get quietly wrong.

\set ON_ERROR_STOP on
\o /dev/null

insert into auth.users (id, email) values
  ('aaaa1111-0000-0000-0000-000000000001', 'nina@example.com'),
  ('bbbb2222-0000-0000-0000-000000000002', 'omar@example.com');

select public.ensure_cycle('2026-08-17', 100000, 500);

select public.ensure_portfolio(
  'aaaa1111-0000-0000-0000-000000000001',
  (select id from public.weekly_cycles where monday = '2026-08-17' and league_id is null));
select public.ensure_portfolio(
  'bbbb2222-0000-0000-0000-000000000002',
  (select id from public.weekly_cycles where monday = '2026-08-17' and league_id is null));

-- ---------------------------------------------------------------------------
-- Is there anything left to record today
-- ---------------------------------------------------------------------------
-- marks_needed_today is asked on page renders, so it decides whether the
-- recorder runs at all. It used to be answered in the app by looking at one
-- portfolio of one cycle, which was true while the week was the only contest
-- and became wrong the day a league could run its own alongside it: the week
-- having been written says nothing about whether the battle was.

-- A clean day: everybody in the open week is unrecorded.
select public.assert(
  public.marks_needed_today('2026-08-20'),
  'a day nobody has been marked for still needs recording'
);

select public.record_portfolio_mark(
  (select id from public.portfolios
   where user_id = 'aaaa1111-0000-0000-0000-000000000001'),
  '2026-08-20', 100500, 0.5);

select public.assert(
  public.marks_needed_today('2026-08-20'),
  'and it still does while somebody else in the same week has not been'
);

select public.record_portfolio_mark(
  (select id from public.portfolios
   where user_id = 'bbbb2222-0000-0000-0000-000000000002'),
  '2026-08-20', 99500, -0.5);

select public.assert(
  not public.marks_needed_today('2026-08-20'),
  'once every portfolio in the week has the day, there is nothing to do'
);

-- Now a league's battle, which is a second open contest.
insert into public.leagues (id, name, owner_id, invite_code)
values ('dddd4444-0000-0000-0000-000000000004', 'The Pit',
        'aaaa1111-0000-0000-0000-000000000001', 'PITT2345');

insert into public.league_members (league_id, user_id, role) values
  ('dddd4444-0000-0000-0000-000000000004', 'aaaa1111-0000-0000-0000-000000000001', 'owner');

select public.create_battle(
  'aaaa1111-0000-0000-0000-000000000001',
  'dddd4444-0000-0000-0000-000000000004',
  'silicon', 'long', 'month', '2026-08-17', '2026-09-16', 100000, 'SOXX');

select public.ensure_portfolio(
  'aaaa1111-0000-0000-0000-000000000001',
  (select id from public.weekly_cycles
   where league_id = 'dddd4444-0000-0000-0000-000000000004'));

/*
  The day the week is finished with, and the battle has not been touched.
  This is the case the old check got wrong: it read the week, found it done,
  and reported that there was nothing left to record -- so a month long
  contest would have lost a day of its shape every day, and a shape cannot be
  worked out afterwards.
*/
select public.assert(
  public.marks_needed_today('2026-08-20'),
  'a battle nobody has recorded needs the day even when the week is done'
);

select public.record_portfolio_mark(
  (select p.id from public.portfolios p
   join public.weekly_cycles c on c.id = p.cycle_id
   where c.league_id = 'dddd4444-0000-0000-0000-000000000004'),
  '2026-08-20', 104000, 4.0);

select public.assert(
  not public.marks_needed_today('2026-08-20'),
  'and is finished with it once it has been'
);

-- A battle's marks are its own. They must not turn up on the week's card.
select public.assert(
  (select count(*) from public.portfolio_marks m
   join public.portfolios p on p.id = m.portfolio_id
   join public.weekly_cycles c on c.id = p.cycle_id
   where c.league_id is null and m.on_date = '2026-08-20') = 2,
  'a battle''s close is filed under its own portfolio, not the week''s'
);

-- ---------------------------------------------------------------------------
-- A contest that is over is not asked about again
-- ---------------------------------------------------------------------------
-- Otherwise every battle a league ever finished would keep the recorder busy
-- for ever, and the answer to "is there anything to do" would be yes on every
-- page render for the rest of the product's life.

update public.weekly_cycles set status = 'closed'
where league_id = 'dddd4444-0000-0000-0000-000000000004';

-- The week is still open, so tomorrow is still wanted -- by the week.
select public.assert(
  public.marks_needed_today('2026-08-21'),
  'the open week still wants the next day'
);

select public.record_portfolio_mark(
  (select id from public.portfolios
   where user_id = 'aaaa1111-0000-0000-0000-000000000001'
     and cycle_id = (select id from public.weekly_cycles where league_id is null)),
  '2026-08-21', 100000, 0.0);
select public.record_portfolio_mark(
  (select id from public.portfolios
   where user_id = 'bbbb2222-0000-0000-0000-000000000002'
     and cycle_id = (select id from public.weekly_cycles where league_id is null)),
  '2026-08-21', 100000, 0.0);

/*
  Now the only portfolio without the day belongs to the settled battle. If
  status were not part of the question this would still be asking for it.
*/
select public.assert(
  not public.marks_needed_today('2026-08-21'),
  'a finished contest is not waiting for tomorrow''s close'
);

do $$
begin
  perform set_config('request.jwt.claims',
    '{"sub": "aaaa1111-0000-0000-0000-000000000001"}', true);
  set local role authenticated;

  begin
    perform public.marks_needed_today('2026-08-20');
    raise exception 'FAILED: a player asked the recorder what it had left to do';
  exception when insufficient_privilege then
    raise notice 'ok: only the service role asks what still needs recording';
  end;
end $$;
