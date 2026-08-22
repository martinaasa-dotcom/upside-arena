/*
  A week is not scored on a price we do not have.

  score_cycle valued a holding at zero whenever its symbol was missing from
  the closing prices handed to it:

      coalesce((p_closing_prices ->> h.symbol)::numeric, 0)

  So one absent quote did not fail the settlement. It priced that company at
  nothing, wrote the result, and marked the week scored -- and because scoring
  is idempotent on purpose, the wrong number is the final one. A player who
  held two companies through a flat week and finished level was told they were
  down ten per cent, with no way to appeal and nothing anywhere saying why.

  Zero is not a missing value. It is the worst possible one, which is what
  makes this worse than the invented figures the rest of the app refuses.

  The app already declines to call this when a price is absent, and that is
  where the check belongs first: it can say so in plain words and try again on
  the next pass. This is the second line, for the same reason every other rule
  in this schema is enforced here -- the caller is one refactor away from
  forgetting, and the database is the thing that cannot be talked round.
*/

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
  unpriced text;
  season public.seasons;
begin
  select * into cycle from public.weekly_cycles where id = p_cycle_id for update;
  if cycle.id is null then
    raise exception 'unknown cycle';
  end if;

  if cycle.benchmark_open is null or cycle.benchmark_open <= 0 then
    raise exception 'cycle has no benchmark open to measure against';
  end if;

  if p_benchmark_close is null or p_benchmark_close <= 0 then
    raise exception 'cycle has no benchmark close to measure against';
  end if;

  /*
    Everything still held has to have a price before anything is written.
    Named in the error, because "settlement failed" sends somebody to the logs
    and "no closing price for MSFT" sends them to the feed.
  */
  select string_agg(distinct h.symbol, ', ' order by h.symbol)
  into unpriced
  from public.holdings h
  join public.portfolios p on p.id = h.portfolio_id
  where p.cycle_id = p_cycle_id
    and h.quantity > 0
    and coalesce((p_closing_prices ->> h.symbol)::numeric, 0) <= 0;

  if unpriced is not null then
    raise exception 'no closing price for %', unpriced;
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
          h.quantity * (p_closing_prices ->> h.symbol)::numeric
        ), 0),
        2
      ) as total,
      round(
        ((
          p2.cash + coalesce(sum(
            h.quantity * (p_closing_prices ->> h.symbol)::numeric
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

revoke all on function public.score_cycle(uuid, jsonb, numeric) from public, anon, authenticated;
grant execute on function public.score_cycle(uuid, jsonb, numeric) to service_role;
