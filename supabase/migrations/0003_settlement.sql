-- Upside Arena, phase 3a: settling a finished week without a scheduler.
--
-- Nothing here depends on a cron job firing at a particular minute. A week is
-- settled by whoever notices it is due, and the claim below makes sure that
-- however many notice at once, only one does the work.

-- ---------------------------------------------------------------------------
-- A claim, so two settlers cannot both score the same week
-- ---------------------------------------------------------------------------

alter table public.weekly_cycles
  add column scoring_started_at timestamptz;

comment on column public.weekly_cycles.scoring_started_at is
  'When a settler claimed this week. Used to release a claim whose owner died.';

/*
  Claims a week for scoring, returning true only to the caller that won.

  A settler that crashes after claiming would otherwise wedge the week in
  "scoring" for ever, so a claim older than p_stale_after can be taken over.
  Scoring is idempotent, so a duplicate run costs a little work and changes
  nothing.
*/
create or replace function public.claim_cycle_for_scoring(
  p_cycle_id uuid,
  p_stale_after interval default '10 minutes'
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed integer;
begin
  update public.weekly_cycles
  set status = 'scoring',
      scoring_started_at = now()
  where id = p_cycle_id
    and (
      status = 'open'
      or (status = 'scoring' and scoring_started_at < now() - p_stale_after)
    );

  get diagnostics claimed = row_count;
  return claimed > 0;
end;
$$;

/*
  Weeks that have finished but have not been scored.

  A week ends at Friday's close, which is the Monday plus four days. The
  caller supplies the current New York date rather than the database guessing
  at a timezone.
*/
create or replace function public.due_cycles(p_today date)
returns setof public.weekly_cycles
language sql
security definer
set search_path = public
as $$
  select *
  from public.weekly_cycles
  where status in ('open', 'scoring')
    and monday + 4 < p_today
  order by monday asc
$$;

-- ---------------------------------------------------------------------------
-- Releasing a claim that could not be completed
-- ---------------------------------------------------------------------------
-- If prices could not be fetched, the week goes back to open rather than
-- sitting in "scoring" until the stale timeout, so the next attempt is
-- immediate.

create or replace function public.release_cycle_claim(p_cycle_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.weekly_cycles
  set status = 'open', scoring_started_at = null
  where id = p_cycle_id and status = 'scoring'
$$;

-- ---------------------------------------------------------------------------
-- score_cycle, now also rolling the result into lifetime stats
-- ---------------------------------------------------------------------------
-- Replaces the phase 2 version. Same scoring, plus the profile totals the plan
-- keeps separate from the current week.
--
-- Still idempotent, which matters more now: lifetime totals must not count a
-- week twice if a retry happens. It only credits portfolios that had not been
-- scored before.

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

  -- Which portfolios are being credited for the first time. Lifetime totals
  -- are only moved for these, so scoring twice cannot count a week twice.
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

  /*
    Lifetime totals. weeks_played is the count this average is over, so the
    running mean has to be computed before it is incremented.
  */
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

  update public.weekly_cycles
  set status = 'closed',
      benchmark_close = p_benchmark_close,
      scoring_started_at = null,
      closed_at = now()
  where id = p_cycle_id;

  return scored;
end;
$$;

comment on column public.profiles.career_alpha_avg is
  'Average points ahead of the market per week. Shown to a player as "against the market", never under a jargon name.';

-- ---------------------------------------------------------------------------
-- Only the service role settles
-- ---------------------------------------------------------------------------

revoke all on function public.claim_cycle_for_scoring(uuid, interval) from public, anon, authenticated;
revoke all on function public.due_cycles(date) from public, anon, authenticated;
revoke all on function public.release_cycle_claim(uuid) from public, anon, authenticated;
revoke all on function public.score_cycle(uuid, jsonb, numeric) from public, anon, authenticated;

grant execute on function public.claim_cycle_for_scoring(uuid, interval) to service_role;
grant execute on function public.due_cycles(date) to service_role;
grant execute on function public.release_cycle_claim(uuid) to service_role;
grant execute on function public.score_cycle(uuid, jsonb, numeric) to service_role;
