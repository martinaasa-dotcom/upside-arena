-- Upside Arena: battles. A league's own contest, with its own rules and its
-- own length.
--
-- The house game is one week, buy anything, most money on Friday wins. It is
-- the game and it is not changing. What this adds is a second contest running
-- beside it, owned by a league rather than by the house, in which the rule
-- book is different: semiconductors only, or one company all week, or pick
-- the losers instead of the winners, or three months instead of five days.
--
-- The decision worth writing down is that a battle is a weekly_cycle.
--
-- It could have been a table of its own, and that would have meant a second
-- portfolio table, a second holdings table, a second trade log, a second
-- settlement and a second set of row level security policies to get wrong.
-- Every one of those already exists here and every one of them is already
-- keyed on a cycle. So a battle is a cycle with a league on it, a format, a
-- direction and an end date, and the engine does not know the difference.
--
-- Four things follow from that, and each is enforced below rather than left
-- to the application:
--
--   1. A battle never touches a career. score_cycle credits weeks_played,
--      best_week_return, career_alpha_avg and the season only for the house
--      week. A league that ran a short-only fortnight has not changed
--      anybody's lifetime record, and a season table that could be entered by
--      inventing a favourable format would not be a season table.
--
--   2. A battle is private to its league. weekly_cycles used to be readable
--      by anybody signed in, which was right when the only row was this
--      week's. A league's contest, its rules and its dates are the league's.
--
--   3. Short positions are the engine's business, not the screen's. The
--      direction lives on the cycle, execute_trade reads it when covering and
--      score_cycle reads it when valuing, so there is no way to open a short
--      that is then settled as though it were long.
--
--   4. A contest ends when it ends. due_cycles used to work out Friday from
--      the Monday, which cannot express a fortnight or a year, so the end
--      date is now recorded rather than derived.

-- ---------------------------------------------------------------------------
-- The new shape of a cycle
-- ---------------------------------------------------------------------------

alter table public.weekly_cycles
  -- The last day of the contest, at that day's close. Recorded rather than
  -- derived, because "the Monday plus four" cannot describe a year.
  add column ends_on date,

  -- Which rule book. Matches an id in src/lib/game/formats.ts. Not a foreign
  -- key to a table of formats: the rules are code, and a row that claimed to
  -- describe them would be a second, quieter version of them.
  add column format text not null default 'open',

  -- Whether a position gains when the price rises or when it falls. Kept here
  -- rather than looked up from the format so that the two functions that must
  -- agree about it read it from the same place the contest was created with.
  add column direction text not null default 'long'
    check (direction in ('long', 'short')),

  -- The league whose contest this is. Null is the house week, which is every
  -- row that existed before this migration.
  add column league_id uuid references public.leagues (id) on delete cascade,

  -- Which of the lengths in src/lib/game/lengths.ts was chosen. Kept for what
  -- it is called on screen; the dates are what actually decide anything.
  add column length text not null default 'week',

  -- Who started it, so they are the one who may call it off.
  add column created_by uuid references auth.users (id) on delete set null;

-- Every week that already exists ended on its Friday, which is where the old
-- derivation put it.
update public.weekly_cycles set ends_on = monday + 4 where ends_on is null;

alter table public.weekly_cycles
  alter column ends_on set not null,
  add constraint weekly_cycles_ends_on_or_after_start check (ends_on >= monday);

/*
  A cycle that does not say when it ends, ends on its Friday.

  Not a column default, because a default cannot read another column of the
  row it is defaulting in. It is here so the rule lives with the table rather
  than in each of the places that insert into it: the two functions below both
  supply an end date, and this is what makes a week inserted by anything else
  -- a fixture, a backfill, a console -- still a well-formed week rather than
  a not-null violation.
*/
create or replace function public.weekly_cycles_default_ends_on()
returns trigger
language plpgsql
as $$
begin
  if new.ends_on is null then
    new.ends_on := new.monday + 4;
  end if;
  return new;
end;
$$;

create trigger weekly_cycles_ends_on_defaults
  before insert on public.weekly_cycles
  for each row execute function public.weekly_cycles_default_ends_on();

comment on column public.weekly_cycles.ends_on is
  'The last day of the contest. A week is the Monday plus four; a battle can be anything from that day to a year out.';
comment on column public.weekly_cycles.league_id is
  'The league whose battle this is, or null for the house week everybody plays.';
comment on column public.weekly_cycles.direction is
  'long: a position gains when the price rises. short: it gains when the price falls, and can never be worth less than nothing.';

-- ---------------------------------------------------------------------------
-- One house week per Monday, and any number of battles
-- ---------------------------------------------------------------------------
-- The old unique on monday was what stopped two servers racing to create the
-- same week. It still has to do that, and it now has to stop doing it to
-- battles, which are allowed to start on a Monday somebody else's already did.

alter table public.weekly_cycles drop constraint weekly_cycles_monday_key;

create unique index weekly_cycles_one_house_week_idx
  on public.weekly_cycles (monday)
  where league_id is null;

/*
  And one live battle per league.

  Not one per league per format: a league running four contests at once is
  four scoreboards and no conversation, and the whole value of a battle is
  that everybody is in the same one. Finished battles are not covered, so a
  league can run as many as it likes one after another.
*/
create unique index weekly_cycles_one_live_battle_idx
  on public.weekly_cycles (league_id)
  where league_id is not null and status <> 'closed';

create index weekly_cycles_league_idx on public.weekly_cycles (league_id);
create index weekly_cycles_ends_on_idx on public.weekly_cycles (ends_on);

-- ---------------------------------------------------------------------------
-- Who may read a cycle
-- ---------------------------------------------------------------------------
-- The house week is public among players: when it started, what it is
-- measured against, whether it is still running. A league's battle is the
-- league's, the same way its standings are.

drop policy "cycles are readable by signed-in players" on public.weekly_cycles;

create policy "cycles are readable by the people in them"
  on public.weekly_cycles for select
  to authenticated
  using (
    league_id is null
    or public.is_league_member(league_id, auth.uid())
  );

-- ---------------------------------------------------------------------------
-- due_cycles, on the recorded end date
-- ---------------------------------------------------------------------------

create or replace function public.due_cycles(p_today date)
returns setof public.weekly_cycles
language sql
security definer
set search_path = public
as $$
  select *
  from public.weekly_cycles
  where status in ('open', 'scoring')
    and ends_on < p_today
  order by ends_on asc, monday asc
$$;

revoke all on function public.due_cycles(date) from public, anon, authenticated;
grant execute on function public.due_cycles(date) to service_role;

-- ---------------------------------------------------------------------------
-- set_benchmark_open
-- ---------------------------------------------------------------------------
-- What a contest is measured from, filled in by the first caller who learns
-- it. ensure_cycle already does this for the house week; a battle can be
-- started at the weekend, when there is no opening price to know yet.
--
-- Only ever writes over a null. The number a contest was measured from must
-- not change once anybody has been shown a result built on it.

create or replace function public.set_benchmark_open(
  p_cycle_id uuid,
  p_open numeric
)
returns public.weekly_cycles
language plpgsql
security definer
set search_path = public
as $$
declare
  cycle public.weekly_cycles;
begin
  if p_open is not null and p_open > 0 then
    update public.weekly_cycles
    set benchmark_open = p_open
    where id = p_cycle_id and benchmark_open is null;
  end if;

  select * into cycle from public.weekly_cycles where id = p_cycle_id;
  return cycle;
end;
$$;

revoke all on function public.set_benchmark_open(uuid, numeric)
  from public, anon, authenticated;
grant execute on function public.set_benchmark_open(uuid, numeric) to service_role;

-- ---------------------------------------------------------------------------
-- create_battle
-- ---------------------------------------------------------------------------
-- Any member may start one, not only the owner.
--
-- That is a deliberate choice about what a league is. Renaming it is the
-- owner's, because the name is the thing they made. Choosing what everybody
-- plays this fortnight is not: a league where only one person can propose a
-- game is a league where one person plays and four people watch.

create or replace function public.create_battle(
  p_user_id uuid,
  p_league_id uuid,
  p_format text,
  p_direction text,
  p_length text,
  p_starts_on date,
  p_ends_on date,
  p_starting_balance numeric,
  p_benchmark_symbol text,
  p_benchmark_open numeric default null
)
returns public.weekly_cycles
language plpgsql
security definer
set search_path = public
as $$
declare
  cycle public.weekly_cycles;
begin
  if not public.is_league_member(p_league_id, p_user_id) then
    raise exception 'not a member of that league';
  end if;

  if p_ends_on < p_starts_on then
    raise exception 'a battle cannot end before it starts';
  end if;

  -- Checked here as well as by the index below it, so the caller gets a
  -- sentence rather than a constraint name.
  if exists (
    select 1 from public.weekly_cycles
    where league_id = p_league_id and status <> 'closed'
  ) then
    raise exception 'this league already has a battle running';
  end if;

  insert into public.weekly_cycles (
    monday, ends_on, status, format, direction, length,
    league_id, created_by, benchmark_symbol, benchmark_open, starting_balance
  )
  values (
    p_starts_on, p_ends_on, 'open', p_format, p_direction, p_length,
    p_league_id, p_user_id, p_benchmark_symbol, p_benchmark_open,
    p_starting_balance
  )
  returning * into cycle;

  return cycle;
exception
  when unique_violation then
    raise exception 'this league already has a battle running';
end;
$$;

-- ---------------------------------------------------------------------------
-- cancel_battle
-- ---------------------------------------------------------------------------
/*
  Calling one off, by whoever started it.

  This exists because a year is a long time to be wrong about. Somebody who
  picks the wrong length by accident cannot be told the league is stuck with
  it until next August, and there is no honest way to shorten a contest partway
  through: the result would be measured over a stretch nobody agreed to.

  So it is deleted rather than closed, and everything played inside it goes
  with it. A cancelled battle did not happen. That is the only version of this
  that cannot be used to throw away a result somebody was losing: a closed
  battle, which is to say a settled one, cannot be cancelled at all.
*/
create or replace function public.cancel_battle(
  p_user_id uuid,
  p_cycle_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  cycle public.weekly_cycles;
begin
  select * into cycle from public.weekly_cycles where id = p_cycle_id for update;

  if cycle.id is null or cycle.league_id is null then
    raise exception 'that is not a battle';
  end if;

  if cycle.created_by is distinct from p_user_id then
    raise exception 'only the person who started it can call it off';
  end if;

  if cycle.status = 'closed' then
    raise exception 'that battle is already finished';
  end if;

  delete from public.weekly_cycles where id = p_cycle_id;
  return true;
end;
$$;

revoke all on function public.create_battle(uuid, uuid, text, text, text, date, date, numeric, text, numeric)
  from public, anon, authenticated;
revoke all on function public.cancel_battle(uuid, uuid) from public, anon, authenticated;

grant execute on function public.create_battle(uuid, uuid, text, text, text, date, date, numeric, text, numeric) to service_role;
grant execute on function public.cancel_battle(uuid, uuid) to service_role;

-- ---------------------------------------------------------------------------
-- execute_trade, now aware of which way a position faces
-- ---------------------------------------------------------------------------
/*
  Two changes, and nothing else about a trade moves.

  The window. A contest that has not started or has already ended takes no
  trades. The status check already covered the second case for the house week,
  because a week is claimed for scoring the moment it is due; a battle started
  on a Saturday for a Monday is the case the status cannot see. The date is
  supplied by the caller rather than read from the server clock, for the same
  reason due_cycles takes one: this database has no opinion about New York.

  Covering a short. Opening one costs cash exactly as a purchase does, so the
  buy side is untouched. Closing one pays back what was put in plus whatever
  the price has fallen since, which is `2 * cost - shares * price`, and never
  less than nothing. That floor is the whole difference between this and a
  real short, and it is deliberate: an unbounded loss on pretend money teaches
  the one lesson about shorting that should not be taught with pretend money.
*/
create or replace function public.execute_trade(
  p_user_id uuid,
  p_cycle_id uuid,
  p_symbol text,
  p_side text,
  p_quantity numeric,
  p_price numeric,
  p_max_per_minute integer default 10,
  p_max_per_cycle integer default 500,
  p_today date default null
)
returns public.trades
language plpgsql
security definer
set search_path = public
as $$
declare
  cycle public.weekly_cycles;
  portfolio public.portfolios;
  holding public.holdings;
  trade public.trades;
  gross numeric(18, 2);
  proceeds numeric(18, 2);
  recent integer;
  total integer;
  sold_cost numeric(18, 2);
begin
  if p_side not in ('buy', 'sell') then
    raise exception 'side must be buy or sell';
  end if;

  if p_quantity is null or p_quantity <= 0 or p_quantity <> trunc(p_quantity) then
    raise exception 'quantity must be a whole number of shares';
  end if;

  if p_price is null or p_price <= 0 then
    raise exception 'price must be positive';
  end if;

  select * into cycle from public.weekly_cycles where id = p_cycle_id;
  if cycle.id is null then
    raise exception 'unknown cycle';
  end if;

  -- A settled contest is settled. Reopening one would change a result someone
  -- has already been told.
  if cycle.status <> 'open' then
    raise exception 'this week is closed for trading';
  end if;

  if p_today is not null then
    if p_today < cycle.monday then
      raise exception 'this contest has not started yet';
    end if;
    if p_today > cycle.ends_on then
      raise exception 'this week is closed for trading';
    end if;
  end if;

  -- Nobody trades in a league contest they have left, or were never in.
  if cycle.league_id is not null
     and not public.is_league_member(cycle.league_id, p_user_id) then
    raise exception 'not a member of that league';
  end if;

  portfolio := public.ensure_portfolio(p_user_id, p_cycle_id);

  -- Lock this player's row for the rest of the transaction, so two trades
  -- sent at once cannot both spend the same cash.
  select * into portfolio
  from public.portfolios
  where id = portfolio.id
  for update;

  -- Anti-cheat. A person cannot click this fast, so anything above the limit
  -- is a script working a leaderboard.
  select count(*) into recent
  from public.trades
  where portfolio_id = portfolio.id
    and executed_at > now() - interval '1 minute';

  if recent >= p_max_per_minute then
    raise exception 'too many trades, slow down';
  end if;

  select count(*) into total
  from public.trades
  where portfolio_id = portfolio.id;

  if total >= p_max_per_cycle then
    raise exception 'trade limit for this week reached';
  end if;

  gross := round(p_quantity * p_price, 2);

  select * into holding
  from public.holdings
  where portfolio_id = portfolio.id and symbol = p_symbol
  for update;

  if p_side = 'buy' then
    if gross > portfolio.cash then
      raise exception 'not enough cash';
    end if;

    update public.portfolios
    set cash = cash - gross
    where id = portfolio.id;

    if holding.id is null then
      insert into public.holdings (portfolio_id, symbol, quantity, cost_basis)
      values (portfolio.id, p_symbol, p_quantity, gross);
    else
      update public.holdings
      set quantity = quantity + p_quantity,
          cost_basis = cost_basis + gross
      where id = holding.id;
    end if;
  else
    if holding.id is null or holding.quantity < p_quantity then
      raise exception 'you do not own that many shares';
    end if;

    -- Cost basis leaves in the same proportion as the shares, so what remains
    -- still reflects what was paid for it.
    sold_cost := round(holding.cost_basis * (p_quantity / holding.quantity), 2);

    if cycle.direction = 'short' then
      -- What was put in, plus what the price has fallen since. Floored,
      -- because a name may never cost more than was staked on it.
      proceeds := greatest(round(2 * sold_cost - gross, 2), 0);
    else
      proceeds := gross;
    end if;

    update public.portfolios
    set cash = cash + proceeds
    where id = portfolio.id;

    if holding.quantity = p_quantity then
      delete from public.holdings where id = holding.id;
    else
      update public.holdings
      set quantity = quantity - p_quantity,
          cost_basis = greatest(cost_basis - sold_cost, 0)
      where id = holding.id;
    end if;
  end if;

  /*
    The trade is logged at the price that was actually seen, not at whatever
    the cash worked out to. The log is the evidence behind a score, and a
    short covered at 47.20 was covered at 47.20 however the money moved.
  */
  insert into public.trades (portfolio_id, symbol, side, quantity, price, value)
  values (portfolio.id, p_symbol, p_side, p_quantity, p_price, gross)
  returning * into trade;

  return trade;
end;
$$;

-- The old eight-argument version would otherwise stay callable beside the new
-- one, and PostgREST would have two overloads to choose between.
drop function if exists public.execute_trade(uuid, uuid, text, text, numeric, numeric, integer, integer);

revoke all on function public.execute_trade(uuid, uuid, text, text, numeric, numeric, integer, integer, date)
  from public, anon, authenticated;
grant execute on function public.execute_trade(uuid, uuid, text, text, numeric, numeric, integer, integer, date) to service_role;

-- ---------------------------------------------------------------------------
-- score_cycle, valuing both directions and keeping battles out of a career
-- ---------------------------------------------------------------------------

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
  */
  update public.portfolios p
  set final_value = v.total,
      return_percent = v.return_percent,
      benchmark_diff = v.return_percent - benchmark_return
  from (
    select
      p2.id,
      round(p2.cash + coalesce(sum(
        case when v_short
          then greatest(
            2 * h.cost_basis - h.quantity * (p_closing_prices ->> h.symbol)::numeric,
            0
          )
          else h.quantity * (p_closing_prices ->> h.symbol)::numeric
        end
      ), 0), 2) as total,
      round(
        ((
          p2.cash + coalesce(sum(
            case when v_short
              then greatest(
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

revoke all on function public.score_cycle(uuid, jsonb, numeric) from public, anon, authenticated;
grant execute on function public.score_cycle(uuid, jsonb, numeric) to service_role;

-- ---------------------------------------------------------------------------
-- ensure_cycle, against a partial unique index
-- ---------------------------------------------------------------------------
/*
  Two things here would otherwise be silently wrong now, and both of them are
  the same mistake: a house week and a battle can share a start date.

  ON CONFLICT (monday) inferred the old table-wide unique constraint. That
  constraint is gone, replaced by an index over the house weeks only, and
  Postgres will only infer a partial index when the statement repeats its
  predicate. Without the `where league_id is null` the insert raises rather
  than losing politely, so the second of two servers racing to open Monday
  would fail instead of finding the week the first one made.

  And the SELECT after it looked up a week by its Monday alone. A league that
  started a battle on that Monday has a row with the same date, and the house
  week the whole app runs on could have come back as somebody's short-only
  fortnight.
*/
create or replace function public.ensure_cycle(
  p_monday date,
  p_starting_balance numeric,
  p_benchmark_open numeric default null
)
returns public.weekly_cycles
language plpgsql
security definer
set search_path = public
as $$
declare
  cycle public.weekly_cycles;
begin
  insert into public.weekly_cycles (monday, ends_on, starting_balance, benchmark_open)
  values (p_monday, p_monday + 4, p_starting_balance, p_benchmark_open)
  on conflict (monday) where league_id is null do nothing;

  select * into cycle
  from public.weekly_cycles
  where monday = p_monday and league_id is null;

  -- The benchmark open is not known until the market has opened, so the first
  -- caller to learn it fills it in.
  if cycle.benchmark_open is null and p_benchmark_open is not null then
    update public.weekly_cycles
    set benchmark_open = p_benchmark_open
    where id = cycle.id
    returning * into cycle;
  end if;

  return cycle;
end;
$$;

revoke all on function public.ensure_cycle(date, numeric, numeric)
  from public, anon, authenticated;
grant execute on function public.ensure_cycle(date, numeric, numeric) to service_role;
