-- Upside Arena, section 2.7: a season on top of the week.
--
-- A week is the whole game: everyone starts level on Monday and it is settled
-- on Friday. That is deliberately short, and short is why it works. But a game
-- whose longest arc is five days gives somebody nothing to come back for in
-- March that they did not already have in January.
--
-- So a quarter of weeks is a season. It changes nothing about how a week is
-- scored, it grants nothing that affects a score, and it can be ignored
-- entirely by somebody who only wants to play this week.

-- ---------------------------------------------------------------------------
-- seasons
-- ---------------------------------------------------------------------------
-- One row per calendar quarter, made when the first week inside it is scored
-- rather than laid out years in advance. A season nobody played is a row
-- nobody needed.

create table public.seasons (
  id uuid primary key default gen_random_uuid(),

  -- The first day of the quarter, New York calendar. Unique, so two settlers
  -- racing to open the same season cannot both win.
  starts_on date not null unique,
  ends_on date not null,

  -- As it is written on screen: "2026 Q3".
  name text not null,

  status text not null default 'open'
    check (status in ('open', 'closed')),

  created_at timestamptz not null default now(),
  closed_at timestamptz,

  constraint seasons_ends_after_it_starts check (ends_on > starts_on)
);

comment on table public.seasons is
  'A quarter of trading weeks. Aggregates results that are already settled; never changes one.';

create index seasons_status_idx on public.seasons (status);

-- Which season a week belongs to. Filled in when the week is scored, because
-- that is the only moment it matters and an unscored week contributes nothing.
alter table public.weekly_cycles
  add column season_id uuid references public.seasons (id) on delete set null;

create index weekly_cycles_season_idx on public.weekly_cycles (season_id);

-- ---------------------------------------------------------------------------
-- season_results
-- ---------------------------------------------------------------------------
-- One row per player per season, built up a week at a time.
--
-- Sums rather than averages, so a week can be added without recomputing the
-- season from scratch and without a rounding error compounding thirteen times.
-- The average is worked out when it is shown.

create table public.season_results (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,

  weeks_played integer not null default 0,
  -- Weeks finished ahead of the market. The plan's measure of a good week.
  weeks_ahead integer not null default 0,

  sum_return_percent numeric(14, 4) not null default 0,
  sum_benchmark_diff numeric(14, 4) not null default 0,
  best_week_return numeric(10, 4),

  -- Filled in when the season closes. Null while it runs, because a rank in a
  -- season with weeks left in it is a standing, not a result.
  final_rank integer,

  updated_at timestamptz not null default now(),

  unique (season_id, user_id),
  constraint season_results_counts_not_negative check (
    weeks_played >= 0 and weeks_ahead >= 0 and weeks_ahead <= weeks_played
  )
);

create index season_results_season_idx on public.season_results (season_id);
create index season_results_user_idx on public.season_results (user_id);

create trigger season_results_touch_updated_at
  before update on public.season_results
  for each row execute function public.touch_updated_at();

comment on column public.season_results.sum_benchmark_diff is
  'Points ahead of the market, added up over the season. Divided by weeks played when shown.';

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.seasons enable row level security;
alter table public.season_results enable row level security;

-- When a season runs is not a secret, and a season table nobody can read is
-- not a season table.
create policy "seasons are readable by signed-in players"
  on public.seasons for select
  to authenticated
  using (true);

/*
  A season standing is public within the game, the same way a league table is.
  It carries a rank and a return and nothing else: names and pictures are
  joined on by the server, which decides what of a profile may be shown.
*/
create policy "season standings are readable by signed-in players"
  on public.season_results for select
  to authenticated
  using (true);

-- No write policy on either, for anybody. A season result a player can write
-- is not a result.

-- ---------------------------------------------------------------------------
-- season_for
-- ---------------------------------------------------------------------------
-- The season a given Monday belongs to, made if it does not exist yet.

create or replace function public.season_for(p_monday date)
returns public.seasons
language plpgsql
security definer
set search_path = public
as $$
declare
  first_day date := date_trunc('quarter', p_monday)::date;
  season public.seasons;
begin
  -- Two settlers can reach this at once for the first week of a quarter, so
  -- the insert loses politely rather than raising.
  insert into public.seasons (starts_on, ends_on, name)
  values (
    first_day,
    (first_day + interval '3 months')::date - 1,
    to_char(first_day, 'YYYY') || ' Q' || extract(quarter from first_day)::text
  )
  on conflict (starts_on) do nothing;

  select * into season from public.seasons where starts_on = first_day;
  return season;
end;
$$;

-- ---------------------------------------------------------------------------
-- record_season_week
-- ---------------------------------------------------------------------------
-- Rolls one settled week into its season.
--
-- Called from score_cycle for portfolios being credited for the first time,
-- so scoring a week twice cannot count it twice. Nothing here reads a price
-- or decides a return: it only adds up numbers that are already final.

create or replace function public.record_season_week(
  p_season_id uuid,
  p_user_id uuid,
  p_return_percent numeric,
  p_benchmark_diff numeric
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.season_results (
    season_id, user_id, weeks_played, weeks_ahead,
    sum_return_percent, sum_benchmark_diff, best_week_return
  )
  values (
    p_season_id, p_user_id, 1,
    case when p_benchmark_diff > 0 then 1 else 0 end,
    coalesce(p_return_percent, 0),
    coalesce(p_benchmark_diff, 0),
    p_return_percent
  )
  on conflict (season_id, user_id) do update
  set weeks_played = public.season_results.weeks_played + 1,
      weeks_ahead = public.season_results.weeks_ahead
        + case when p_benchmark_diff > 0 then 1 else 0 end,
      sum_return_percent =
        public.season_results.sum_return_percent + coalesce(p_return_percent, 0),
      sum_benchmark_diff =
        public.season_results.sum_benchmark_diff + coalesce(p_benchmark_diff, 0),
      best_week_return = greatest(
        coalesce(public.season_results.best_week_return, p_return_percent),
        p_return_percent
      );
$$;

-- ---------------------------------------------------------------------------
-- The season rewards
-- ---------------------------------------------------------------------------
-- Titles, like every other reward: worn next to a name, affecting nothing.
-- None of them has a coin price, because a season finish that could be bought
-- would not be a season finish.

insert into public.rewards
  (id, kind, name, description, streak_required, sort_order, coin_price, plus_only, style_key)
values
  ('title.season_champion', 'title', 'Season champion',
   'Finished a season first, ahead of the market by more than anyone.',
   null, 400, null, false, null),
  ('title.season_podium', 'title', 'Season podium',
   'Finished a season in the top three.', null, 390, null, false, null),
  ('title.season_regular', 'title', 'Season regular',
   'Played eight weeks of one season.', null, 380, null, false, null);

-- ---------------------------------------------------------------------------
-- close_season
-- ---------------------------------------------------------------------------
-- Ranks a finished season and hands out what it earned.
--
-- Ranked on points ahead of the market per week, not on total return: a
-- season is thirteen weeks of a level start each, so adding up returns would
-- just reward whoever turned up most. Somebody who played two weeks of a
-- quarter is left unranked rather than crowned on a fortnight's luck.
--
-- Idempotent. It only ranks a season that is still open, so a retry after a
-- crash finds nothing to do rather than granting a second champion.

create or replace function public.close_season(
  p_season_id uuid,
  p_min_weeks integer default 3,
  p_regular_weeks integer default 8
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  season public.seasons;
  ranked integer := 0;
  finisher record;
begin
  select * into season from public.seasons where id = p_season_id for update;
  if season.id is null then
    raise exception 'unknown season';
  end if;

  if season.status = 'closed' then
    return 0;
  end if;

  with placings as (
    select
      id,
      row_number() over (
        order by sum_benchmark_diff / nullif(weeks_played, 0) desc, weeks_played desc
      ) as place
    from public.season_results
    where season_id = p_season_id and weeks_played >= p_min_weeks
  )
  update public.season_results r
  set final_rank = placings.place
  from placings
  where r.id = placings.id;

  get diagnostics ranked = row_count;

  for finisher in
    select user_id, final_rank, weeks_played
    from public.season_results
    where season_id = p_season_id
  loop
    if finisher.final_rank = 1 then
      insert into public.user_rewards (user_id, reward_id)
      values (finisher.user_id, 'title.season_champion')
      on conflict (user_id, reward_id) do nothing;
    end if;

    if finisher.final_rank is not null and finisher.final_rank <= 3 then
      insert into public.user_rewards (user_id, reward_id)
      values (finisher.user_id, 'title.season_podium')
      on conflict (user_id, reward_id) do nothing;
    end if;

    -- Turning up for most of a quarter is worth something on its own, and is
    -- the one season reward that does not depend on beating anybody.
    if finisher.weeks_played >= p_regular_weeks then
      insert into public.user_rewards (user_id, reward_id)
      values (finisher.user_id, 'title.season_regular')
      on conflict (user_id, reward_id) do nothing;
    end if;
  end loop;

  update public.seasons
  set status = 'closed', closed_at = now()
  where id = p_season_id;

  return ranked;
end;
$$;

-- ---------------------------------------------------------------------------
-- due_seasons
-- ---------------------------------------------------------------------------
-- Seasons that have run out and have no week still waiting to be scored.
--
-- The second half matters: closing a season while its last Friday is still
-- unsettled would rank everybody on a quarter with a week missing from it.

create or replace function public.due_seasons(p_today date)
returns setof public.seasons
language sql
security definer
set search_path = public
as $$
  select s.*
  from public.seasons s
  where s.status = 'open'
    and s.ends_on < p_today
    and not exists (
      select 1 from public.weekly_cycles c
      where c.monday between s.starts_on and s.ends_on
        and c.status <> 'closed'
    )
  order by s.starts_on asc
$$;

-- ---------------------------------------------------------------------------
-- score_cycle, now also rolling the week into its season
-- ---------------------------------------------------------------------------
-- Replaces the phase 3a version. The scoring itself is untouched, character
-- for character: a season is an aggregate laid on top of settled weeks, and
-- adding one must not change what a week is worth.

create or replace function public.score_cycle(
  p_cycle_id uuid,
  p_closing_prices jsonb,
  p_benchmark_close numeric
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  cycle public.weekly_cycles;
  benchmark_return numeric(10, 4);
  scored integer := 0;
  season public.seasons;
begin
  select * into cycle from public.weekly_cycles where id = p_cycle_id for update;
  if cycle.id is null then
    raise exception 'unknown cycle';
  end if;

  if cycle.benchmark_open is null or cycle.benchmark_open <= 0 then
    raise exception 'cycle has no benchmark open to measure against';
  end if;

  benchmark_return :=
    round(((p_benchmark_close - cycle.benchmark_open) / cycle.benchmark_open) * 100, 4);

  create temporary table if not exists newly_scored (
    portfolio_id uuid primary key,
    user_id uuid not null,
    return_percent numeric(10, 4),
    benchmark_diff numeric(10, 4)
  ) on commit drop;

  delete from newly_scored;

  insert into newly_scored (portfolio_id, user_id)
  select id, user_id
  from public.portfolios
  where cycle_id = p_cycle_id and return_percent is null;

  update public.portfolios p
  set final_value = v.total,
      return_percent = v.return_percent,
      benchmark_diff = v.return_percent - benchmark_return
  from (
    select
      p2.id,
      round(
        p2.cash + coalesce(sum(
          h.quantity * coalesce((p_closing_prices ->> h.symbol)::numeric, 0)
        ), 0),
        2
      ) as total,
      round(
        ((
          p2.cash + coalesce(sum(
            h.quantity * coalesce((p_closing_prices ->> h.symbol)::numeric, 0)
          ), 0) - p2.starting_balance
        ) / p2.starting_balance) * 100,
        4
      ) as return_percent
    from public.portfolios p2
    left join public.holdings h on h.portfolio_id = p2.id
    where p2.cycle_id = p_cycle_id
    group by p2.id, p2.cash, p2.starting_balance
  ) v
  where p.id = v.id;

  get diagnostics scored = row_count;

  update newly_scored n
  set return_percent = p.return_percent,
      benchmark_diff = p.benchmark_diff
  from public.portfolios p
  where p.id = n.portfolio_id;

  update public.profiles pr
  set weeks_played = pr.weeks_played + 1,
      best_week_return = greatest(
        coalesce(pr.best_week_return, n.return_percent),
        n.return_percent
      ),
      career_alpha_avg = round(
        (coalesce(pr.career_alpha_avg, 0) * pr.weeks_played + n.benchmark_diff)
          / (pr.weeks_played + 1),
        4
      )
  from newly_scored n
  where pr.id = n.user_id and n.return_percent is not null;

  /*
    The season. Resolved from the Monday rather than from today, so a week
    settled late lands in the quarter it was played in.
  */
  season := public.season_for(cycle.monday);

  perform public.record_season_week(
    season.id, n.user_id, n.return_percent, n.benchmark_diff
  )
  from newly_scored n
  where n.return_percent is not null;

  update public.weekly_cycles
  set status = 'closed',
      benchmark_close = p_benchmark_close,
      scoring_started_at = null,
      closed_at = now(),
      season_id = season.id
  where id = p_cycle_id;

  return scored;
end;
$$;

-- ---------------------------------------------------------------------------
-- Only the service role writes a season
-- ---------------------------------------------------------------------------

revoke all on function public.season_for(date) from public, anon, authenticated;
revoke all on function public.record_season_week(uuid, uuid, numeric, numeric)
  from public, anon, authenticated;
revoke all on function public.close_season(uuid, integer, integer)
  from public, anon, authenticated;
revoke all on function public.due_seasons(date) from public, anon, authenticated;

grant execute on function public.season_for(date) to service_role;
grant execute on function public.record_season_week(uuid, uuid, numeric, numeric)
  to service_role;
grant execute on function public.close_season(uuid, integer, integer) to service_role;
grant execute on function public.due_seasons(date) to service_role;
