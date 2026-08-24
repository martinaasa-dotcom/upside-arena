/*
  A season table that does not read the whole quarter to show fifty rows.

  getSeasonView asked for every season_results row in the season, then every
  profile behind them, then sorted the lot in JavaScript and threw away all
  but the first fifty. That is fine with the twenty players Arena has today
  and it is the shape that stops working first: a season is a quarter of an
  open game, so the rows are everybody who has played a week in three months,
  and the page that reads them is the one people open to see whether they are
  climbing.

  The ordering moves into SQL, where it can be done once over an index and cut
  to a page. It is exactly the ordering close_season uses to award the final
  places, which matters more than the speed does: the live table and the
  finished one are the same table, and a season that reads one way all quarter
  and hands out its medals in another order would be the app calling itself a
  liar on the last day.

  Which is also why close_season is rewritten below with one line changed. Both
  now break a tie on the player id. It is arbitrary and it is meant to be:
  ranking.ts says the same thing about the weekly tables, for the same reason.
  Two players level on the average and level on weeks played were previously
  placed in whatever order Postgres happened to return them, so which of them
  was champion could depend on when a row was last updated. A tie-break that
  is arbitrary but fixed is the difference between a table nobody can argue
  with and one that quietly disagrees with itself between two page loads.

  The caller's own row always comes back, whether or not it is on the page.
  Somebody 340th needs to see where they are far more than the top fifty need
  to see each other.
*/

create or replace function public.season_standings(
  p_season_id uuid,
  p_user_id uuid,
  p_min_weeks integer default 3,
  p_limit integer default 50
)
returns table (
  user_id uuid,
  place integer,
  ranked boolean,
  weeks_played integer,
  weeks_ahead integer,
  sum_return_percent numeric,
  sum_benchmark_diff numeric,
  best_week_return numeric,
  final_rank integer
)
language sql
stable
security definer
set search_path = public
as $$
  with scored as (
    select
      r.user_id,
      r.weeks_played,
      r.weeks_ahead,
      r.sum_return_percent,
      r.sum_benchmark_diff,
      r.best_week_return,
      r.final_rank,
      (r.weeks_played >= p_min_weeks) as is_ranked,
      case
        when r.weeks_played > 0 then r.sum_benchmark_diff / r.weeks_played
        else 0
      end as average_diff
    from public.season_results r
    where r.season_id = p_season_id
  ),
  /*
    Everybody appears and only those who played enough of the quarter are
    placed, so somebody two weeks in is shown where they would stand rather
    than hidden. A table you are missing from is not one you can watch
    yourself climb.

    Called place rather than position, which is a reserved word here.
  */
  ordered as (
    select
      scored.*,
      row_number() over (
        order by is_ranked desc, average_diff desc, weeks_played desc, user_id
      )::integer as place
    from scored
  )
  select
    user_id,
    place,
    is_ranked,
    weeks_played,
    weeks_ahead,
    sum_return_percent,
    sum_benchmark_diff,
    best_week_return,
    final_rank
  from ordered
  where place <= p_limit or user_id = p_user_id
  order by place;
$$;

create index if not exists season_results_season_idx
  on public.season_results (season_id);

revoke all on function public.season_standings(uuid, uuid, integer, integer)
  from public, anon, authenticated;
grant execute on function public.season_standings(uuid, uuid, integer, integer) to service_role;

-- ---------------------------------------------------------------------------
-- close_season, breaking a tie the same way the live table does
-- ---------------------------------------------------------------------------

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
        order by sum_benchmark_diff / nullif(weeks_played, 0) desc,
                 weeks_played desc,
                 user_id
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
