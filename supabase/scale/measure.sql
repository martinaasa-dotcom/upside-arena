-- What the rooms actually cost, once there are people in them.
--
-- Every query here is the shape a room really runs, against the database
-- supabase/scale/seed.sql just built. Each is planned and executed for real
-- and then held to two rules.
--
-- A budget in milliseconds, deliberately loose, because this is a laptop or a
-- shared runner and not production: the number that matters is not 12ms
-- against 9ms, it is 12ms against 900ms.
--
-- And a ceiling on how many rows it hands back, which is the rule with teeth.
-- PostgREST answers a Supabase project with at most db-max-rows, and a new
-- project is set to 1,000. Nothing in this repository mentions that number, no
-- read anywhere pages past it, and several of these grow with the number of
-- people in a league. A query that quietly returns the first thousand of five
-- thousand rows does not fail: it answers, and the answer is wrong.
--
-- A NOTE ON WHAT IS DELIBERATELY NOT CHECKED HERE.
--
-- The first draft failed a query for sequentially scanning a table, which
-- sounds like the right rule and is not. Reading all 2,000 profiles to find
-- 200 of them is the correct plan, Postgres knows it, and the plan changes on
-- its own once the table is large enough for an index to win. A rule against
-- it fails correct queries and passes as soon as somebody widens it. What
-- does not self-correct is a query returning more rows than its caller can
-- use, so that is what is measured.
--
-- ONE RULE ABOUT WRITING A QUERY HERE, AND IT IS NOT OPTIONAL.
--
-- Where the app passes a list of ids, this file passes the **same list, as a
-- literal array**, never as a subquery. PostgREST turns .in("user_id", ids)
-- into `user_id = any('{...}')` with the ids spelled out, because the app has
-- already fetched them. Those two spellings do not plan alike, and the first
-- draft of this file learned that the expensive way: written with subqueries,
-- the record query sequentially scanned all 200,000 portfolios and took 91ms,
-- and the same question written the way the app actually asks it used
-- portfolios_user_idx and took 8ms. The subquery version was a bug in this
-- file reporting a bug in the app. A harness that does not send what the app
-- sends measures something nobody runs.
--
-- Run it with ./scripts/scale-rehearsal.sh.

\set ON_ERROR_STOP on

/*
  What a Supabase project will hand back in one response.

  Not a number this file chose. It is db-max-rows, which a new project is set
  to 1,000, and it is applied by PostgREST without an error: the response is
  simply shorter than the truth. Every read below is measured against it with
  room to spare, because a read sitting at 990 today is a read that breaks on
  the day somebody joins a league.
*/
create temporary table limits (name text primary key, value integer);
insert into limits values ('postgrest_max_rows', 1000);

create function pg_temp.explain_lines(query text)
returns setof text
language plpgsql
as $$
begin
  return query execute 'explain (analyze, buffers) ' || query;
end;
$$;

create function pg_temp.measure(
  label text,
  query text,
  budget_ms numeric,
  max_rows integer
)
returns void
language plpgsql
as $$
declare
  plan text;
  took numeric;
  rows_out integer;
  cap integer;
begin
  select string_agg(line, e'\n')
  into plan
  from pg_temp.explain_lines(query) as line;

  took := substring(plan from 'Execution Time: ([0-9.]+) ms')::numeric;
  rows_out := substring(plan from 'actual time=[0-9.]+\.\.[0-9.]+ rows=([0-9]+)')::integer;

  select value into cap from limits where name = 'postgrest_max_rows';

  if max_rows > cap then
    raise exception 'FAILED: % is allowed % rows, which is past what a response can carry', label, max_rows;
  end if;

  if rows_out > max_rows then
    raise exception E'FAILED: % returned % rows, over its ceiling of %\n%',
      label, rows_out, max_rows, plan;
  end if;

  if took > budget_ms then
    raise exception E'FAILED: % took % ms, over its % ms budget\n%',
      label, took, budget_ms, plan;
  end if;

  raise notice 'ok: % -- % ms, % rows', label, took, rows_out;
end;
$$;

-- The player who joined everything, because that is the worst room and the
-- person who will be looking at it.
\set who '00000000-0000-4000-8000-000000000001'
\set league '00000000-0000-4000-a000-000000000001'
\set season '00000000-0000-4000-b000-000000000001'

-- Everything the app would have fetched before it asks the questions below.
select
  (select id::text
     from public.weekly_cycles
     where league_id is null and status = 'open') as open_cycle,
  (select array_agg(id)::text
     from public.weekly_cycles
     where league_id is null and status = 'closed') as closed_cycles,
  (select array_agg(user_id)::text
     from public.league_members
     where league_id = :'league') as roster,
  (select array_agg(league_id)::text
     from public.league_members
     where user_id = :'who') as my_leagues
\gset

-- The portfolios a league room has in hand by the time it asks for holdings.
select
  (select array_agg(p.id)::text
     from public.portfolios p
     where p.cycle_id = :'open_cycle'::uuid
       and p.user_id = any(:'roster'::uuid[])) as league_portfolios,
  (select array_agg(p.id)::text
     from public.portfolios p
     where p.cycle_id = :'open_cycle'::uuid
       and p.user_id = :'who') as my_portfolio
\gset

-- ---------------------------------------------------------------------------
-- /home
-- ---------------------------------------------------------------------------

select pg_temp.measure(
  'home reads this week''s portfolio',
  format($q$
    select p.id, p.cash, p.starting_balance
    from public.portfolios p
    where p.user_id = %L and p.cycle_id = %L
  $q$, :'who', :'open_cycle'),
  50,
  5
);

select pg_temp.measure(
  'home reads what you own',
  format($q$
    select h.portfolio_id, h.symbol, h.quantity, h.cost_basis
    from public.holdings h
    where h.portfolio_id = any(%L::uuid[])
  $q$, :'my_portfolio'),
  50,
  200
);

select pg_temp.measure(
  'home reads what you did',
  format($q$
    select t.symbol, t.side, t.quantity, t.price, t.executed_at
    from public.trades t
    where t.portfolio_id = any(%L::uuid[])
    order by t.executed_at desc
    limit 20
  $q$, :'my_portfolio'),
  50,
  20
);

-- ---------------------------------------------------------------------------
-- /leagues
-- ---------------------------------------------------------------------------

select pg_temp.measure(
  'the leagues list finds your leagues',
  format($q$
    select league_id from public.league_members where user_id = %L
  $q$, :'who'),
  50,
  30
);

/*
  How the list counts each league's members: by asking the database, since
  migration 0030. It used to read every membership row of every league you
  belong to, which at the Plus ceiling of thirty leagues of fifty is 1,500
  rows fetched to produce thirty integers -- past what one response carries,
  so a league would have shown fewer members than it had.
*/
select pg_temp.measure(
  'the leagues list counts the rosters',
  format($q$
    select * from public.league_member_counts(%L::uuid[])
  $q$, :'my_leagues'),
  60,
  30
);

-- ---------------------------------------------------------------------------
-- /leagues/[id]
-- ---------------------------------------------------------------------------

select pg_temp.measure(
  'a league room reads its roster',
  format($q$
    select user_id from public.league_members where league_id = %L
  $q$, :'league'),
  50,
  50
);

select pg_temp.measure(
  'a league room reads the week''s portfolios',
  format($q$
    select p.id, p.user_id, p.cash, p.starting_balance
    from public.portfolios p
    where p.cycle_id = %L and p.user_id = any(%L::uuid[])
  $q$, :'open_cycle', :'roster'),
  60,
  50
);

select pg_temp.measure(
  'a league room reads every member''s holdings',
  format($q$
    select h.portfolio_id, h.symbol, h.quantity
    from public.holdings h
    where h.portfolio_id = any(%L::uuid[])
  $q$, :'league_portfolios'),
  80,
  600
);

/*
  And whether each member traded, which used to be one row per trade. A player
  may place MAX_TRADES_PER_CYCLE of them in a week, which is 500, so a full
  league could put 25,000 rows on the wire to answer fifty yes-or-nos. The
  seed leaves one player at 480 trades so this measures the real thing.
*/
select pg_temp.measure(
  'a league room reads every member''s trade counts',
  format($q$
    select * from public.portfolio_trade_counts(%L::uuid[])
  $q$, :'league_portfolios'),
  60,
  50
);

select pg_temp.measure(
  'a league room reads every member''s closes',
  format($q$
    select m.portfolio_id, m.on_date, m.value, m.return_percent
    from public.portfolio_marks m
    where m.portfolio_id = any(%L::uuid[])
  $q$, :'league_portfolios'),
  80,
  250
);

select pg_temp.measure(
  'a league room reads every member''s player tag',
  format($q$
    select id, display_name, handle, avatar_url
    from public.profiles
    where id = any(%L::uuid[])
  $q$, :'roster'),
  50,
  50
);

-- ---------------------------------------------------------------------------
-- /leagues/[id]/record
-- ---------------------------------------------------------------------------

/*
  One page of the record's grid.

  This is the one read that genuinely needs its rows: the head-to-head below
  it is per member per week and no aggregate replaces that. Fifty members over
  a year is 2,600 rows, so it is read a page at a time (lib/supabase/read-all)
  and this measures a page.
*/
select pg_temp.measure(
  'a record reads a page of every settled week the league played',
  format($q$
    select p.user_id, p.cycle_id, p.return_percent, p.benchmark_diff
    from public.portfolios p
    where p.user_id = any(%L::uuid[])
      and p.cycle_id = any(%L::uuid[])
      and p.return_percent is not null
    limit 500
  $q$, :'roster', :'closed_cycles'),
  100,
  500
);

-- ---------------------------------------------------------------------------
-- /profile
-- ---------------------------------------------------------------------------

select pg_temp.measure(
  'a profile reads the weeks you have played',
  format($q$
    select p.cycle_id, p.return_percent, p.benchmark_diff, p.final_value, c.monday
    from public.portfolios p
    join public.weekly_cycles c on c.id = p.cycle_id
    where p.user_id = %L
      and p.return_percent is not null
      and c.league_id is null
    order by c.monday desc
    limit 26
  $q$, :'who'),
  50,
  26
);

-- ---------------------------------------------------------------------------
-- /season
-- ---------------------------------------------------------------------------
-- The one query in the app that reads a table of everybody. It ranks the
-- whole quarter and returns the top 50 plus wherever you are, which is why
-- it was moved into the database rather than done where the page is built.

select pg_temp.measure(
  'the season table ranks the whole quarter',
  format($q$
    select * from public.season_standings(%L, %L, 3, 50)
  $q$, :'season', :'who'),
  250,
  60
);

-- ---------------------------------------------------------------------------
-- Settlement
-- ---------------------------------------------------------------------------
-- Not a room, and the one query whose cost everybody pays at once: the sweep
-- after Friday's close reads every holding in the week to price it.

select pg_temp.measure(
  'settlement finds the weeks that are due',
  $q$select * from public.due_cycles('2026-08-24')$q$,
  100,
  50
);

/*
  Which companies the week holds, which is what settlement has to price.

  It used to select every holding row in the week and de-duplicate where the
  settler runs: 16,000 rows for about forty symbols. Short, the settler would
  not have noticed -- and score_cycle would have raised about a company it was
  never told about, released the claim, and done the same thing on every
  attempt after that. See migration 0030.
*/
select pg_temp.measure(
  'settlement collects a whole week''s symbols',
  format($q$
    select * from public.symbols_in_cycle(%L)
  $q$, :'open_cycle'),
  600,
  100
);

\echo
\echo 'Scale rehearsal passed.'
