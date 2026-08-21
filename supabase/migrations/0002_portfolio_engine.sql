-- Upside Arena, phase 2: the paper portfolio engine.
--
-- Weekly cycles, one portfolio per player per cycle, holdings, and trades.
--
-- The security model here is different from phase 1 and deliberately so.
-- A player may READ their own portfolio, holdings and trades, and may write
-- NONE of them. There is no insert, update or delete policy for a player on
-- any table in this file. Every write goes through the functions at the
-- bottom, which only the service role may call, so the server decides what a
-- trade costs. A client that could set its own price could hand itself a
-- perfect week, and no amount of application code would stop it.

-- ---------------------------------------------------------------------------
-- weekly_cycles
-- ---------------------------------------------------------------------------
-- One row per trading week. Monday's open to Friday's close, New York time.

create table public.weekly_cycles (
  id uuid primary key default gen_random_uuid(),

  -- The Monday this week starts on, as a New York calendar date. Unique, so
  -- two servers racing to create the same week cannot both win.
  monday date not null unique,

  status text not null default 'open'
    check (status in ('open', 'scoring', 'closed')),

  benchmark_symbol text not null default 'SPY',
  -- Where the benchmark opened on Monday, and closed on Friday. Filled in as
  -- the week runs; the close stays null until the week is scored.
  benchmark_open numeric(18, 6),
  benchmark_close numeric(18, 6),

  starting_balance numeric(18, 2) not null,

  created_at timestamptz not null default now(),
  closed_at timestamptz,

  constraint weekly_cycles_starting_balance_positive
    check (starting_balance > 0)
);

comment on table public.weekly_cycles is
  'One trading week. Everyone in it starts with the same balance.';

create index weekly_cycles_status_idx on public.weekly_cycles (status);

-- ---------------------------------------------------------------------------
-- portfolios
-- ---------------------------------------------------------------------------
-- A player's money for one week. Reset means a new row, never an edited one,
-- so last week's result stays exactly as it was scored.

create table public.portfolios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  cycle_id uuid not null references public.weekly_cycles (id) on delete cascade,

  -- Recorded per portfolio rather than read back from a constant, so changing
  -- the starting balance later cannot rewrite what an old week meant.
  starting_balance numeric(18, 2) not null,
  cash numeric(18, 2) not null,

  -- Filled in when the week is scored. Null while the week is running.
  final_value numeric(18, 2),
  return_percent numeric(10, 4),
  benchmark_diff numeric(10, 4),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (user_id, cycle_id),
  constraint portfolios_cash_not_negative check (cash >= 0)
);

comment on column public.portfolios.benchmark_diff is
  'Player return minus benchmark return, in percentage points. Never shown to a player under a jargon name.';

create index portfolios_user_idx on public.portfolios (user_id);
create index portfolios_cycle_idx on public.portfolios (cycle_id);
-- Standings read this constantly once leagues arrive.
create index portfolios_cycle_return_idx
  on public.portfolios (cycle_id, return_percent desc nulls last);

-- ---------------------------------------------------------------------------
-- holdings
-- ---------------------------------------------------------------------------
-- Current position per symbol. Derivable from trades, kept separately because
-- valuing a portfolio on every page load must not mean replaying its history.

create table public.holdings (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios (id) on delete cascade,
  symbol text not null,
  quantity numeric(18, 4) not null,
  -- Total paid for the quantity currently held. Average cost is this divided
  -- by quantity; storing the total avoids rounding drift as a position grows.
  cost_basis numeric(18, 2) not null,
  updated_at timestamptz not null default now(),

  unique (portfolio_id, symbol),
  constraint holdings_quantity_positive check (quantity > 0),
  -- Whole shares only, so position sizing stays legible. Drop this check if
  -- fractional shares are ever allowed.
  constraint holdings_whole_shares check (quantity = trunc(quantity)),
  constraint holdings_cost_basis_not_negative check (cost_basis >= 0),
  constraint holdings_symbol_shape check (symbol ~ '^[A-Z0-9.\-]{1,12}$')
);

create index holdings_portfolio_idx on public.holdings (portfolio_id);

-- ---------------------------------------------------------------------------
-- trades
-- ---------------------------------------------------------------------------
-- Append-only. A trade is never edited or deleted, because the trade log is
-- the evidence behind a score.

create table public.trades (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios (id) on delete cascade,
  symbol text not null,
  side text not null check (side in ('buy', 'sell')),
  quantity numeric(18, 4) not null,
  price numeric(18, 6) not null,
  -- quantity * price, stored so a filled trade never re-derives differently.
  value numeric(18, 2) not null,
  executed_at timestamptz not null default now(),

  constraint trades_quantity_positive check (quantity > 0),
  constraint trades_price_positive check (price > 0)
);

create index trades_portfolio_idx on public.trades (portfolio_id, executed_at desc);
-- The rate limiter counts recent trades per portfolio.
create index trades_recent_idx on public.trades (portfolio_id, executed_at);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
-- Read your own. Write nothing.

alter table public.weekly_cycles enable row level security;
alter table public.portfolios enable row level security;
alter table public.holdings enable row level security;
alter table public.trades enable row level security;

-- The week itself is public knowledge among players: when it started, what it
-- is measured against, whether it is still running.
create policy "cycles are readable by signed-in players"
  on public.weekly_cycles for select
  to authenticated
  using (true);

create policy "a player reads their own portfolios"
  on public.portfolios for select
  to authenticated
  using (auth.uid() = user_id);

create policy "a player reads their own holdings"
  on public.holdings for select
  to authenticated
  using (
    exists (
      select 1 from public.portfolios p
      where p.id = holdings.portfolio_id and p.user_id = auth.uid()
    )
  );

create policy "a player reads their own trades"
  on public.trades for select
  to authenticated
  using (
    exists (
      select 1 from public.portfolios p
      where p.id = trades.portfolio_id and p.user_id = auth.uid()
    )
  );

-- Deliberately no insert, update or delete policy for `authenticated` on any
-- table above. The functions below are the only way in.

create trigger portfolios_touch_updated_at
  before update on public.portfolios
  for each row execute function public.touch_updated_at();

create trigger holdings_touch_updated_at
  before update on public.holdings
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- ensure_cycle
-- ---------------------------------------------------------------------------
-- Returns the week beginning on the given Monday, creating it if this is the
-- first time anyone has asked. Lazily created rather than waiting for a
-- scheduled job, so a new player is never told to come back on Monday.

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
  insert into public.weekly_cycles (monday, starting_balance, benchmark_open)
  values (p_monday, p_starting_balance, p_benchmark_open)
  on conflict (monday) do nothing;

  select * into cycle from public.weekly_cycles where monday = p_monday;

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

-- ---------------------------------------------------------------------------
-- ensure_portfolio
-- ---------------------------------------------------------------------------
-- A player's money for a week. Created on first sight of the week, with the
-- full starting balance in cash.

create or replace function public.ensure_portfolio(
  p_user_id uuid,
  p_cycle_id uuid
)
returns public.portfolios
language plpgsql
security definer
set search_path = public
as $$
declare
  cycle public.weekly_cycles;
  portfolio public.portfolios;
begin
  select * into cycle from public.weekly_cycles where id = p_cycle_id;
  if cycle.id is null then
    raise exception 'unknown cycle';
  end if;

  insert into public.portfolios (user_id, cycle_id, starting_balance, cash)
  values (p_user_id, p_cycle_id, cycle.starting_balance, cycle.starting_balance)
  on conflict (user_id, cycle_id) do nothing;

  select * into portfolio
  from public.portfolios
  where user_id = p_user_id and cycle_id = p_cycle_id;

  return portfolio;
end;
$$;

-- ---------------------------------------------------------------------------
-- execute_trade
-- ---------------------------------------------------------------------------
-- The only way a holding or a cash balance ever changes.
--
-- The price is supplied by the caller, which is safe precisely because only
-- the service role may call this. The server reads the price from the shared
-- quote cache; the browser never sees this function.
--
-- Everything happens in one statement's transaction, so a trade cannot half
-- apply and leave cash spent on shares nobody owns.

create or replace function public.execute_trade(
  p_user_id uuid,
  p_cycle_id uuid,
  p_symbol text,
  p_side text,
  p_quantity numeric,
  p_price numeric,
  p_max_per_minute integer default 10,
  p_max_per_cycle integer default 500
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

  -- A settled week is settled. Reopening one would change a result someone
  -- has already been told.
  if cycle.status <> 'open' then
    raise exception 'this week is closed for trading';
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

    update public.portfolios
    set cash = cash + gross
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

  insert into public.trades (portfolio_id, symbol, side, quantity, price, value)
  values (portfolio.id, p_symbol, p_side, p_quantity, p_price, gross)
  returning * into trade;

  return trade;
end;
$$;

-- ---------------------------------------------------------------------------
-- score_cycle
-- ---------------------------------------------------------------------------
-- Settles a finished week. Prices are supplied by the caller as a map of
-- symbol to closing price, because Postgres has no business fetching them.
--
-- Idempotent: running it twice produces the same numbers, so a retry after a
-- failed job is safe.

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

  update public.weekly_cycles
  set status = 'closed',
      benchmark_close = p_benchmark_close,
      closed_at = now()
  where id = p_cycle_id;

  return scored;
end;
$$;

-- ---------------------------------------------------------------------------
-- Only the service role may write the game
-- ---------------------------------------------------------------------------

revoke all on function public.ensure_cycle(date, numeric, numeric) from public, anon, authenticated;
revoke all on function public.ensure_portfolio(uuid, uuid) from public, anon, authenticated;
revoke all on function public.execute_trade(uuid, uuid, text, text, numeric, numeric, integer, integer) from public, anon, authenticated;
revoke all on function public.score_cycle(uuid, jsonb, numeric) from public, anon, authenticated;

grant execute on function public.ensure_cycle(date, numeric, numeric) to service_role;
grant execute on function public.ensure_portfolio(uuid, uuid) to service_role;
grant execute on function public.execute_trade(uuid, uuid, text, text, numeric, numeric, integer, integer) to service_role;
grant execute on function public.score_cycle(uuid, jsonb, numeric) to service_role;
