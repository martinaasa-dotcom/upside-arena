-- Counting rows by fetching them.
--
-- Four reads in this app answer a question about a number by asking for every
-- row behind it and counting them where the page is built. At a league of six
-- that is invisible. Measured against a launch's worth of players
-- (scripts/scale-rehearsal.sh) it is not:
--
--   the leagues list, to show "12 of 20" beside thirty leagues,
--     fetches 1,500 membership rows to produce 30 integers
--   a league room, to show how many trades each member made,
--     fetches up to 25,000 trade rows to produce 50 integers
--   settling a week, to learn which companies to price,
--     fetches 16,000 holding rows to produce about 40 symbols
--
-- The waste is the smaller half. PostgREST answers with at most db-max-rows,
-- which a Supabase project is set to 1,000 by default, and it applies that
-- without an error: the response is simply shorter than the truth. Nothing in
-- this repository has ever mentioned that number.
--
-- What each of those looks like truncated is worth saying plainly, because
-- they are not the same failure:
--
--   the leagues list shows a smaller number beside a league than the league
--     really has, and nothing anywhere says so
--   a league room under-reports how many trades somebody made, which is a
--     number players compare
--   settlement hands score_cycle a price list missing most of the week's
--     companies, score_cycle raises 'no closing price for X' as it is built
--     to, the claim is released, and the next attempt does exactly the same
--     thing. Past about a hundred and twenty-five players, no week ever
--     settles again.
--
-- The fix is the one this schema already uses twice, in season_standings and
-- in symbols_in_open_weeks: count in the database and send the count. It also
-- means none of the three depends any more on a project setting nobody has
-- checked, which is better than checking it.

-- ---------------------------------------------------------------------------
-- league_member_counts
-- ---------------------------------------------------------------------------
-- How many people are in each of these leagues. One row per league, whatever
-- the rosters add up to.

create or replace function public.league_member_counts(p_league_ids uuid[])
returns table (league_id uuid, members integer)
language sql
stable
security definer
set search_path = public
as $$
  select m.league_id, count(*)::integer
  from public.league_members m
  where m.league_id = any(coalesce(p_league_ids, '{}'))
  group by m.league_id;
$$;

comment on function public.league_member_counts(uuid[]) is
  'Roster sizes for a set of leagues. One row per league, never one per member.';

-- ---------------------------------------------------------------------------
-- portfolio_trade_counts
-- ---------------------------------------------------------------------------
-- How many trades were placed in each of these portfolios. A player may make
-- MAX_TRADES_PER_CYCLE of them in one week, which is 500, so this is the read
-- with the widest gap between the rows behind the answer and the answer.

create or replace function public.portfolio_trade_counts(p_portfolio_ids uuid[])
returns table (portfolio_id uuid, trades integer)
language sql
stable
security definer
set search_path = public
as $$
  select t.portfolio_id, count(*)::integer
  from public.trades t
  where t.portfolio_id = any(coalesce(p_portfolio_ids, '{}'))
  group by t.portfolio_id;
$$;

comment on function public.portfolio_trade_counts(uuid[]) is
  'Trade counts for a set of portfolios. One row per portfolio, never one per trade.';

-- ---------------------------------------------------------------------------
-- symbols_in_cycle
-- ---------------------------------------------------------------------------
-- Which companies a week holds, which is the list settlement has to price.
--
-- symbols_in_open_weeks, two migrations back, is the same question asked of
-- every open week at once, for the split sweep. This one is asked of a single
-- week, by the settler, and it exists for the same stated reason: the join is
-- two levels deep, holdings to portfolios to weeks, and the failure mode of
-- getting it subtly wrong is a short list, which looks exactly like a week
-- with fewer companies in it.

create or replace function public.symbols_in_cycle(p_cycle_id uuid)
returns table (symbol text)
language sql
stable
security definer
set search_path = public
as $$
  select distinct h.symbol
  from public.holdings h
  join public.portfolios p on p.id = h.portfolio_id
  where p.cycle_id = p_cycle_id;
$$;

comment on function public.symbols_in_cycle(uuid) is
  'The distinct companies held in one week. What settlement has to fetch prices for.';

-- ---------------------------------------------------------------------------
-- Who may ask
-- ---------------------------------------------------------------------------
-- All three read across every player, so all three are the service role's.
-- The two count functions are called while a page is built, which is server
-- side and already holds the service role; nothing reaches them from a
-- browser.

revoke all on function public.league_member_counts(uuid[]) from public, anon, authenticated;
revoke all on function public.portfolio_trade_counts(uuid[]) from public, anon, authenticated;
revoke all on function public.symbols_in_cycle(uuid) from public, anon, authenticated;

grant execute on function public.league_member_counts(uuid[]) to service_role;
grant execute on function public.portfolio_trade_counts(uuid[]) to service_role;
grant execute on function public.symbols_in_cycle(uuid) to service_role;
