-- A launch morning, in one database.
--
-- Everything about how these rooms read has been judged against a league of
-- six. That is the shape the seed data has, it is the shape every browser
-- test has, and it is the one shape where an unindexed read cannot be told
-- from an indexed one: at six rows Postgres will sequentially scan and be
-- right to.
--
-- So this builds the thing nobody has: a database with a launch's worth of
-- people in it. The numbers below are deliberately past what Arena expects
-- rather than at it, because a plan that holds at ten times the load is the
-- only kind you can trust at one.

\set ON_ERROR_STOP on

\set players 2000
\set weeks 12
\set leagues 200
\set holdings_each 8
\set trades_each 10

-- ---------------------------------------------------------------------------
-- People
-- ---------------------------------------------------------------------------
-- The signup trigger writes the profile, so this is one insert rather than
-- two, and it exercises that trigger 2,000 times while it is here.

insert into auth.users (id, email, raw_user_meta_data)
select
  ('00000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
  'player' || n || '@example.com',
  '{}'::jsonb
from generate_series(1, :players) as n;

-- Player tags, because a room reads them and a room with 2,000 nulls in it
-- would not be measuring the query anybody runs.
update public.profiles
set display_name = 'Player ' || substr(id::text, 25),
    handle = 'player' || substr(id::text, 25),
    onboarded_at = now();

-- ---------------------------------------------------------------------------
-- Weeks
-- ---------------------------------------------------------------------------
-- Twelve Mondays, the last one open and the eleven before it closed, which is
-- a quarter of play. Dates are fixed rather than relative to today, so a run
-- in March and a run in November measure the same thing.

insert into public.weekly_cycles (
  id, monday, ends_on, status, benchmark_symbol,
  benchmark_open, benchmark_close, starting_balance, closed_at
)
select
  ('00000000-0000-4000-9000-' || lpad(w::text, 12, '0'))::uuid,
  (date '2026-06-01' + (w - 1) * 7),
  (date '2026-06-01' + (w - 1) * 7 + 4),
  case when w = :weeks then 'open' else 'closed' end,
  'SPY',
  500 + w,
  case when w = :weeks then null else 500 + w + 2 end,
  100000,
  case when w = :weeks then null else now() end
from generate_series(1, :weeks) as w;

-- ---------------------------------------------------------------------------
-- Portfolios, one per player per week
-- ---------------------------------------------------------------------------

insert into public.portfolios (
  user_id, cycle_id, starting_balance, cash,
  final_value, return_percent, benchmark_diff
)
select
  u.id,
  c.id,
  100000,
  20000 + (n % 1000),
  case when c.status = 'closed' then 100000 + ((n * 37) % 20000) - 10000 end,
  case when c.status = 'closed' then round((((n * 37) % 20000) - 10000) / 1000.0, 4) end,
  case when c.status = 'closed' then round((((n * 37) % 20000) - 10000) / 1200.0, 4) end
from generate_series(1, :players) as n
join auth.users u
  on u.id = ('00000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid
cross join public.weekly_cycles c
where c.league_id is null;

-- ---------------------------------------------------------------------------
-- Spreading rows over the pool, in 64 bits
-- ---------------------------------------------------------------------------
-- Every `hashtext` below is cast to bigint before anything is added to it,
-- and that cast is the whole of a bug this seed carried from the day it was
-- written.
--
-- `hashtext` returns `integer`, so `abs()` of it lands anywhere in
-- [0, 2147483647], and each of the three uses then adds a small number to it:
-- up to 110 for holdings, 50 for trades and 685 for marks. When a portfolio's
-- id happened to hash within that distance of INT_MAX, the addition overflowed
-- int32 and the seed died with `integer out of range` before `measure.sql`
-- ever ran, so the rehearsal measured nothing at all.
--
-- `portfolios.id` is `gen_random_uuid()`, so the hashes are new on every run
-- and 24,000 portfolios made that roughly a 1 in 130 chance per run, on any
-- branch. It reddened pull requests that had not been near this file, and a
-- re-run always cleared it, which is exactly how a real bug gets filed as a
-- flake. `fbbdd425-6106-46dd-b67e-dee7237f1cc1` hashes to -2147483234 and is
-- the case, if one is ever wanted by hand.
--
-- In 64 bits the addition cannot overflow, and `% 40` and `% 20000` return
-- the same non-negative values they always did, so the seeded data is
-- unchanged apart from the runs that used to have none.
--
-- `abs()` also has no int32 answer for INT_MIN itself, which the same cast
-- settles.

-- ---------------------------------------------------------------------------
-- What they own, what they did, and what it was worth each evening
-- ---------------------------------------------------------------------------
-- Symbols come from a small pool on purpose. Real players crowd into the same
-- forty names, and a pool of 192,000 distinct tickers would make the quote
-- layer's batching look far worse than it is while making every index look
-- far better.

create temporary table scale_symbols (n integer primary key, symbol text);
insert into scale_symbols (n, symbol)
select i, s
from unnest(array[
  'AAPL','MSFT','NVDA','AMZN','GOOGL','META','TSLA','AVGO','BRK-B','LLY',
  'JPM','V','UNH','XOM','MA','COST','HD','PG','JNJ','ABBV',
  'NFLX','BAC','CRM','AMD','KO','PEP','WMT','TMO','CSCO','ORCL',
  'ACN','MCD','ABT','LIN','ADBE','DIS','WFC','TXN','QCOM','SPY'
]) with ordinality as t(s, i);

insert into public.holdings (portfolio_id, symbol, quantity, cost_basis)
select
  p.id,
  s.symbol,
  1 + ((h * 7) % 40),
  round((1 + ((h * 7) % 40)) * (50 + (s.n * 3))::numeric, 2)
from public.portfolios p
cross join generate_series(1, :holdings_each) as h
join scale_symbols s
  on s.n = 1 + ((abs(hashtext(p.id::text)::bigint) + h * 11) % 40);

insert into public.trades (portfolio_id, symbol, side, quantity, price, value, executed_at)
select
  p.id,
  s.symbol,
  case when t % 4 = 0 then 'sell' else 'buy' end,
  1 + ((t * 3) % 20),
  round((50 + (s.n * 3))::numeric, 2),
  round((1 + ((t * 3) % 20)) * (50 + (s.n * 3))::numeric, 2),
  now() - (t || ' hours')::interval
from public.portfolios p
cross join generate_series(1, :trades_each) as t
join scale_symbols s
  on s.n = 1 + ((abs(hashtext(p.id::text)::bigint) + t * 5) % 40);

insert into public.portfolio_marks (portfolio_id, on_date, value, return_percent)
select
  p.id,
  c.monday + (d - 1),
  100000 + ((abs(hashtext(p.id::text)::bigint) + d * 137) % 20000) - 10000,
  round(((((abs(hashtext(p.id::text)::bigint) + d * 137) % 20000) - 10000) / 1000.0)::numeric, 4)
from public.portfolios p
join public.weekly_cycles c on c.id = p.cycle_id
cross join generate_series(1, 5) as d;

-- ---------------------------------------------------------------------------
-- Leagues
-- ---------------------------------------------------------------------------
-- Two hundred leagues over two thousand players, and every player in two of
-- them, which is a roster of twenty. Player 1 is put in eight, because the
-- room that reads worst is the one belonging to somebody who joined
-- everything, and that is the person who will be looking.

insert into public.leagues (id, name, invite_code, owner_id, created_at)
select
  ('00000000-0000-4000-a000-' || lpad(l::text, 12, '0'))::uuid,
  'League ' || l,
  'LG' || lpad(l::text, 6, '0'),
  ('00000000-0000-4000-8000-' || lpad(l::text, 12, '0'))::uuid,
  now()
from generate_series(1, :leagues) as l;

insert into public.league_members (league_id, user_id, role, joined_at)
select distinct
  ('00000000-0000-4000-a000-' || lpad((1 + ((n + k * 97) % :leagues))::text, 12, '0'))::uuid,
  ('00000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
  'member',
  now()
from generate_series(2, :players) as n
cross join generate_series(0, 1) as k
on conflict do nothing;

/*
  Player 1 joins thirty leagues, which is not a guess: it is leaguesJoined on
  the Plus tier in src/lib/billing/plan.ts, and the leagues list reads every
  membership row of every league you are in.
*/
insert into public.league_members (league_id, user_id, role, joined_at)
select
  ('00000000-0000-4000-a000-' || lpad(l::text, 12, '0'))::uuid,
  '00000000-0000-4000-8000-000000000001'::uuid,
  'member',
  now()
from generate_series(1, 30) as l
on conflict do nothing;

/*
  And every one of those thirty is filled to fifty, which is leagueMembers on
  the same tier. The schema allows two hundred and no account can create one,
  so fifty is the largest room that can actually exist. It is the one worth
  measuring, because every read in a league room is "for each of these
  people", and the number of people is the only thing in that sentence that
  varies.
*/
insert into public.league_members (league_id, user_id, role, joined_at)
select
  ('00000000-0000-4000-a000-' || lpad(l::text, 12, '0'))::uuid,
  ('00000000-0000-4000-8000-' || lpad((((l - 1) * 50 + n))::text, 12, '0'))::uuid,
  'member',
  now()
from generate_series(1, 30) as l
cross join generate_series(1, 50) as n
on conflict do nothing;

update public.leagues set max_members = 50;

/*
  And trimmed to fifty, because the generic distribution above also lands
  people in these. A league larger than its own max_members is a state the app
  cannot reach, so measuring one would be measuring a room nobody can open.
  Player 1 is kept in all of them, since the worst case is theirs.
*/
delete from public.league_members m
using (
  select
    league_id,
    user_id,
    row_number() over (
      partition by league_id
      order by (user_id = '00000000-0000-4000-8000-000000000001'::uuid) desc, user_id
    ) as seat
  from public.league_members
) ranked
where m.league_id = ranked.league_id
  and m.user_id = ranked.user_id
  and ranked.seat > 50;

/*
  One player who traded all week.

  MAX_TRADES_PER_CYCLE is 500, so that is what somebody working a leaderboard
  can leave behind in one week, and the league room they are in reads a row
  per trade in order to show a count.
*/
insert into public.trades (portfolio_id, symbol, side, quantity, price, value, executed_at)
select
  p.id,
  'AAPL',
  'buy',
  1,
  100,
  100,
  now() - (t || ' seconds')::interval
from public.portfolios p
join public.weekly_cycles c on c.id = p.cycle_id
cross join generate_series(1, 480) as t
where p.user_id = '00000000-0000-4000-8000-000000000002'::uuid
  and c.status = 'open';

-- ---------------------------------------------------------------------------
-- The quarter
-- ---------------------------------------------------------------------------

insert into public.seasons (id, name, starts_on, ends_on, status)
values (
  '00000000-0000-4000-b000-000000000001',
  '2026 Q3',
  '2026-07-01',
  '2026-09-30',
  'open'
);

insert into public.season_results (
  season_id, user_id, weeks_played, weeks_ahead,
  sum_return_percent, sum_benchmark_diff, best_week_return
)
select
  '00000000-0000-4000-b000-000000000001'::uuid,
  ('00000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
  1 + (n % 12),
  least(n % 7, 1 + (n % 12)),
  round((((n * 37) % 20000) - 10000) / 100.0, 4),
  round((((n * 41) % 20000) - 10000) / 120.0, 4),
  round((((n * 53) % 9000)) / 100.0, 4)
from generate_series(1, :players) as n;

-- Postgres plans on statistics, and a table it has never looked at is a
-- table it will guess about. Without this the measurement measures the
-- absence of an ANALYZE rather than the shape of an index.
analyze;

select
  (select count(*) from auth.users) as players,
  (select count(*) from public.portfolios) as portfolios,
  (select count(*) from public.holdings) as holdings,
  (select count(*) from public.trades) as trades,
  (select count(*) from public.portfolio_marks) as marks,
  (select count(*) from public.league_members) as memberships,
  (select count(*) from public.season_results) as season_rows;
