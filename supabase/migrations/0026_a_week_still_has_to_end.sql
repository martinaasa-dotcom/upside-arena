/*
  A company nobody can price must not stop a week ending for everybody.

  Settling refused, correctly, to score a week with a holding it had no
  closing price for: valuing that position at zero would write a wipeout that
  never happened, and scoring is idempotent, so the wrong number would be the
  final one. That was migration 0015 and it stands.

  What it left behind is a deadlock, and the trigger is ordinary. A company is
  acquired on the Thursday, or delisted, or changes ticker, or is halted and
  never reopens. One player holds it. From that Friday the chart endpoint has
  nothing to say about that symbol and never will again, so every settlement
  pass raises 'no closing price for X', releases its claim and tries again
  forever. Nobody in that week is scored. Not the player holding it: everyone.
  No result, no standings, no streak, no season week, and no message saying
  why, because from the outside it looks exactly like a week that has not
  finished yet.

  So the caller may now name the companies it could not price, and those are
  valued at what was paid for them. Three things make that honest rather than
  convenient:

    It is not an invented number. Cost is a price Arena actually saw and
    recorded, on the trade that opened the position.

    It is the number the player was already looking at. A holding with no
    quote has shown as worth its cost on every screen all week, because that
    is what src/lib/game/formats.ts does with a null price. Settling any other
    way would contradict the screen.

    It has to be said out loud. A symbol that is neither priced nor named
    still stops the week. The refusal is intact for every case except the one
    the caller has taken responsibility for, and src/lib/game/settle.ts only
    takes that responsibility after the benchmark itself has priced, after
    most of the week's other companies have priced, and after a grace period
    long enough that a passing outage upstream is not mistaken for a company
    that has stopped existing.
*/

create or replace function public.score_cycle(
  p_cycle_id uuid,
  p_closing_prices jsonb,
  p_benchmark_close numeric,
  p_at_cost text[] default '{}'
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
  v_season_id uuid;
  v_battle boolean;
  v_short boolean;
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

  v_battle := cycle.league_id is not null;
  v_short := cycle.direction = 'short';
  v_season_id := cycle.season_id;

  /*
    Everything still held has to have a price, or be named as a thing that
    could not be given one. Named in the error, because "settlement failed"
    sends somebody to the logs and "no closing price for MSFT" sends them to
    the feed.

    p_at_cost is the caller saying out loud which companies it could not
    price, and it has to say so: a symbol that is simply missing from both
    still stops the week, which is what keeps a forgotten price from being
    quietly valued at anything at all.
  */
  select string_agg(distinct h.symbol, ', ' order by h.symbol)
  into unpriced
  from public.holdings h
  join public.portfolios p on p.id = h.portfolio_id
  where p.cycle_id = p_cycle_id
    and h.quantity > 0
    and not (h.symbol = any(coalesce(p_at_cost, '{}')))
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

  /*
    `where true` is not decoration. PostgREST connects as `authenticator`,
    which preloads Supabase's safeupdate, and that refuses any DELETE without
    a WHERE clause. This statement had none, so every call to this function
    through the API raised "DELETE requires a WHERE clause" and no week could
    be scored at all.
  */
  delete from newly_scored where true;

  insert into newly_scored (portfolio_id, user_id)
  select id, user_id
  from public.portfolios
  where cycle_id = p_cycle_id and return_percent is null;

  /*
    A short position is worth what was staked on it plus whatever the price
    has fallen since, and never less than nothing. Written here as
    `2 * cost - shares * close` rather than as `cost + (entry - close) * shares`
    because they are the same number and only the first one survives being a
    single expression inside an aggregate. src/lib/game/formats.ts spells out
    the readable form, and the two are checked against each other in the tests.

    A name in p_at_cost is worth what was paid for it, in both directions and
    for the same reason: it is the only figure about that position anybody has
    actually seen. It is what the portfolio screen showed all week whenever a
    price was missing, so settling on it is the one answer that does not
    contradict what the player was looking at.
  */
  update public.portfolios p
  set final_value = v.total,
      return_percent = v.return_percent,
      benchmark_diff = v.return_percent - benchmark_return
  from (
    select
      p2.id,
      round(p2.cash + coalesce(sum(
        case
          when h.symbol = any(coalesce(p_at_cost, '{}')) then h.cost_basis
          when v_short then greatest(
            2 * h.cost_basis - h.quantity * (p_closing_prices ->> h.symbol)::numeric,
            0
          )
          else h.quantity * (p_closing_prices ->> h.symbol)::numeric
        end
      ), 0), 2) as total,
      round(
        ((
          p2.cash + coalesce(sum(
            case
              when h.symbol = any(coalesce(p_at_cost, '{}')) then h.cost_basis
              when v_short then greatest(
                2 * h.cost_basis - h.quantity * (p_closing_prices ->> h.symbol)::numeric,
                0
              )
              else h.quantity * (p_closing_prices ->> h.symbol)::numeric
            end
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

  /*
    A career is made of house weeks and nothing else.

    Everybody plays the same house week under the same rules, which is what
    makes weeks_played, best_week_return and the season comparable at all. A
    league that ran a short-only fortnight has changed nobody's lifetime
    record, and a season table anybody could enter by choosing a format that
    suited them would be a season table worth nothing.
  */
  if not v_battle then
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
    v_season_id := season.id;

    perform public.record_season_week(
      season.id, n.user_id, n.return_percent, n.benchmark_diff
    )
    from newly_scored n
    where n.return_percent is not null;
  end if;

  update public.weekly_cycles
  set status = 'closed',
      benchmark_close = p_benchmark_close,
      scoring_started_at = null,
      closed_at = now(),
      season_id = v_season_id
  where id = p_cycle_id;

  return scored;
end;
$$;
-- The three-argument version would otherwise stay callable beside the new
-- one, and PostgREST would have two overloads to choose between. Dropped
-- after the replace, so there is no moment where no score_cycle exists.
drop function if exists public.score_cycle(uuid, jsonb, numeric);

revoke all on function public.score_cycle(uuid, jsonb, numeric, text[])
  from public, anon, authenticated;
grant execute on function public.score_cycle(uuid, jsonb, numeric, text[]) to service_role;
