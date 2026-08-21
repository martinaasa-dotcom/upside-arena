-- Upside Arena, phase 7: measuring the loop.
--
-- Section 2.8 names four numbers and says the loop only gets tuned if they
-- are measured: D1/D7/D30 retention, streak survival, how full the leagues
-- get, and how often a week actually gets shared.
--
-- All four are computed here, from data Arena already holds, rather than sent
-- to an analytics vendor. That is not squeamishness: shipping every player's
-- trades and standings to a third party to answer four questions we can
-- answer ourselves would add a processor, a disclosure and a leak surface for
-- nothing. What leaves this file is counts, never a person.
--
-- Nothing below is a live query on a page a player sees. These scan whole
-- tables by design and are read by one owner-only screen.

-- ---------------------------------------------------------------------------
-- daily_actives
-- ---------------------------------------------------------------------------
-- One row per person per calendar day they opened Arena.
--
-- Separate from streaks on purpose, and counted in calendar days rather than
-- trading days. A streak deliberately ignores the weekend; retention must
-- not, because somebody who came back on Saturday came back.

create table public.daily_actives (
  user_id uuid not null references auth.users (id) on delete cascade,
  on_date date not null,
  primary key (user_id, on_date)
);

comment on table public.daily_actives is
  'Who opened Arena on which day. Calendar days, unlike streaks. The substrate for retention.';

create index daily_actives_date_idx on public.daily_actives (on_date);

alter table public.daily_actives enable row level security;

create policy "a player reads their own visits"
  on public.daily_actives for select
  to authenticated
  using (auth.uid() = user_id);

create or replace function public.record_daily_active(
  p_user_id uuid,
  p_date date
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.daily_actives (user_id, on_date)
  values (p_user_id, p_date)
  on conflict (user_id, on_date) do nothing;
$$;

-- ---------------------------------------------------------------------------
-- metrics_retention
-- ---------------------------------------------------------------------------
-- Of the people who joined, how many came back a day, a week and a month
-- later.
--
-- Only cohorts old enough to have had the chance are counted. Including
-- yesterday's signups in a D30 figure is how a retention number gets quietly
-- reported as far worse than it is.

create or replace function public.metrics_retention(p_today date)
returns table (
  window_days integer,
  cohort integer,
  returned integer
)
language sql
stable
security definer
set search_path = public
as $$
  with joined as (
    select id as user_id, (created_at at time zone 'America/New_York')::date as joined_on
    from public.profiles
  ),
  windows as (select unnest(array[1, 7, 30]) as days)
  select
    w.days::integer,
    count(*)::integer as cohort,
    count(*) filter (
      where exists (
        select 1 from public.daily_actives a
        where a.user_id = j.user_id
          and a.on_date > j.joined_on
          and a.on_date <= j.joined_on + w.days
      )
    )::integer as returned
  from windows w
  join joined j
    -- Old enough to have had the chance to come back.
    on j.joined_on + w.days <= p_today
  group by w.days
  order by w.days
$$;

-- ---------------------------------------------------------------------------
-- metrics_streaks
-- ---------------------------------------------------------------------------
-- Whether the streak mechanic survives contact with real people.
--
-- The interesting number is not the average, which a handful of enthusiasts
-- drag upwards. It is how many get past the first week at all, and how often
-- a freeze is what carried them.

create or replace function public.metrics_streaks()
returns table (
  players integer,
  alive integer,
  reached_five integer,
  reached_twenty integer,
  longest integer,
  freezes_spent integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    count(*)::integer,
    count(*) filter (where current_streak > 0)::integer,
    count(*) filter (where longest_streak >= 5)::integer,
    count(*) filter (where longest_streak >= 20)::integer,
    coalesce(max(longest_streak), 0)::integer,
    coalesce(sum(freezes_used), 0)::integer
  from public.streaks
$$;

-- ---------------------------------------------------------------------------
-- metrics_leagues
-- ---------------------------------------------------------------------------
-- How full the leagues get. A league of one is somebody who tried to invite a
-- friend and failed, which is the single most useful failure Arena can see.

create or replace function public.metrics_leagues()
returns table (
  leagues integer,
  alone integer,
  with_company integer,
  members integer,
  biggest integer
)
language sql
stable
security definer
set search_path = public
as $$
  with sizes as (
    select l.id, count(m.user_id)::integer as size
    from public.leagues l
    left join public.league_members m on m.league_id = l.id
    group by l.id
  )
  select
    count(*)::integer,
    count(*) filter (where size <= 1)::integer,
    count(*) filter (where size > 1)::integer,
    coalesce(sum(size), 0)::integer,
    coalesce(max(size), 0)::integer
  from sizes
$$;

-- ---------------------------------------------------------------------------
-- metrics_engagement
-- ---------------------------------------------------------------------------
-- The funnel, and the share rate the growth loop depends on.
--
-- Share rate is deliberately measured against weeks that were actually
-- scored, not against players. Somebody who has never finished a week has not
-- declined to share it.

create or replace function public.metrics_engagement(p_today date)
returns table (
  players integer,
  onboarded integer,
  traded integer,
  in_a_league integer,
  weeks_scored integer,
  weeks_shared integer,
  cards_live integer,
  active_today integer,
  active_this_week integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    (select count(*) from public.profiles)::integer,
    (select count(*) from public.profiles where onboarded_at is not null)::integer,
    -- A trade hangs off a portfolio, not off a person, so this counts
    -- through one.
    (select count(distinct p.user_id)
       from public.trades t
       join public.portfolios p on p.id = t.portfolio_id)::integer,
    (select count(distinct user_id) from public.league_members)::integer,
    (select count(*) from public.portfolios where return_percent is not null)::integer,
    (select count(*) from public.share_cards)::integer,
    (select count(*) from public.share_cards where revoked_at is null)::integer,
    (select count(*) from public.daily_actives where on_date = p_today)::integer,
    (select count(distinct user_id) from public.daily_actives
      where on_date > p_today - 7)::integer
$$;

-- ---------------------------------------------------------------------------
-- Only the service role reads or writes any of it
-- ---------------------------------------------------------------------------
-- These scan every player's rows, which is exactly why no client role may
-- call them.

revoke all on function public.record_daily_active(uuid, date) from public, anon, authenticated;
revoke all on function public.metrics_retention(date) from public, anon, authenticated;
revoke all on function public.metrics_streaks() from public, anon, authenticated;
revoke all on function public.metrics_leagues() from public, anon, authenticated;
revoke all on function public.metrics_engagement(date) from public, anon, authenticated;

grant execute on function public.record_daily_active(uuid, date) to service_role;
grant execute on function public.metrics_retention(date) to service_role;
grant execute on function public.metrics_streaks() to service_role;
grant execute on function public.metrics_leagues() to service_role;
grant execute on function public.metrics_engagement(date) to service_role;
