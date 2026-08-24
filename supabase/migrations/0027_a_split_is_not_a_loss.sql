-- Upside Arena: corporate actions, which until now the game did not believe in.
--
-- Nvidia split ten for one on 10 June 2024. Anybody holding a hundred shares
-- woke up holding a thousand, each worth a tenth of what it had been, and not
-- a cent had changed hands. Yahoo's price is post-split from the open of that
-- day, because that is the only price there is: the trade at the old number
-- cannot happen again. Arena's holdings table, meanwhile, still said a
-- hundred.
--
-- So the position was valued at a hundred shares times a tenth of the price,
-- and a player who had done nothing at all was down ninety per cent. The week
-- was then settled on that number, permanently, and the leaderboard printed
-- it. A reverse split does the same thing in the other direction and is worse,
-- because it looks like winning: a one-for-ten leaves the shares at ten times
-- the price and hands somebody a nine hundred per cent week nobody traded for.
--
-- Neither of these is rare. Splits cluster in exactly the companies people in
-- a game like this buy, and reverse splits arrive constantly among the small
-- ones.
--
-- Three parts, and each of them is here rather than in the app for the usual
-- reason: the app is one refactor away from forgetting, and the database is
-- the thing that cannot be talked round.
--
--   symbol_splits is the ledger. One row per company per effective date, and
--   the primary key is what makes applying a split twice impossible however
--   many workers notice it at once.
--
--   split_checks is the day's claim, so one worker asks the provider what
--   happened and the rest get on with serving pages.
--
--   apply_split does the arithmetic, in one transaction, holding by holding.

create table public.symbol_splits (
  symbol text not null,
  -- The day the new share count is the real one, which is a market open.
  effective_on date not null,

  -- Ten for one is 10 and 1. One for ten, the reverse, is 1 and 10.
  numerator numeric(18, 6) not null,
  denominator numeric(18, 6) not null,

  -- What a share was worth when this was applied, after the split. A fraction
  -- of a share cannot be held, so it is paid out in cash, and this is the
  -- price it was paid at.
  price numeric(18, 6) not null,

  holdings_adjusted integer not null default 0,
  -- Positions left alone because the portfolio had already traded the company
  -- after the split took effect, so its share count was already the new one.
  holdings_skipped integer not null default 0,

  applied_at timestamptz not null default now(),

  primary key (symbol, effective_on),
  constraint symbol_splits_ratio_positive check (numerator > 0 and denominator > 0),
  constraint symbol_splits_price_positive check (price > 0),
  constraint symbol_splits_symbol_shape check (symbol ~ '^[A-Z0-9.\-]{1,12}$')
);

comment on table public.symbol_splits is
  'Every share split Arena has applied, so it can never apply one twice.';

create table public.split_checks (
  day date primary key,
  claimed_at timestamptz not null default now()
);

comment on table public.split_checks is
  'The day''s claim to ask the provider what split today. One worker, one ask.';

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
-- Neither table is a player's business. They are enabled with no policy at
-- all, which denies everybody: the service role bypasses row level security,
-- and nothing else has any reason to read them.

alter table public.symbol_splits enable row level security;
alter table public.split_checks enable row level security;

-- ---------------------------------------------------------------------------
-- claim_split_check
-- ---------------------------------------------------------------------------
-- True for the first caller on a given day and false for everybody after,
-- which is the whole of it. There is no release: a check that failed halfway
-- costs nothing to miss, because a split still unapplied is found by
-- tomorrow's check, and the ledger means a split applied twice is applied
-- once.

create or replace function public.claim_split_check(p_day date)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed boolean := false;
begin
  insert into public.split_checks (day) values (p_day)
  on conflict (day) do nothing;

  get diagnostics claimed = row_count;
  return claimed;
end;
$$;

-- ---------------------------------------------------------------------------
-- apply_split
-- ---------------------------------------------------------------------------
--
-- What it does to one holding: multiplies the share count by the ratio, keeps
-- the whole shares, and pays the fraction out in cash at the post-split price,
-- which is what a broker does. The cost basis follows the shares it belongs
-- to, so the average cost per share falls by the ratio and the position's
-- value does not move by more than the price of one share.
--
-- What it deliberately does not touch:
--
--   A week that is already closed. Its result is written and history is not
--   revised. Only open weeks hold live positions.
--
--   A position in a portfolio that has traded that company since the split
--   took effect. Those shares were bought at the post-split price and their
--   count is already the new one, so multiplying it again would invent shares.
--   This is why the check runs before the market opens: at that hour nobody
--   can have traded yet, and this guard has nothing to do.
--
--   Lineup orders. An order for a hundred shares is an order for a hundred
--   shares, at whatever a share costs on the Monday.

create or replace function public.apply_split(
  p_symbol text,
  p_effective_on date,
  p_numerator numeric,
  p_denominator numeric,
  p_price numeric
)
returns public.symbol_splits
language plpgsql
security definer
set search_path = public
as $$
declare
  ledger public.symbol_splits;
  ratio numeric;
  effective_at timestamptz;
  holding record;
  exact numeric;
  kept numeric;
  adjusted integer := 0;
  skipped integer := 0;
begin
  if p_numerator is null or p_numerator <= 0
     or p_denominator is null or p_denominator <= 0 then
    raise exception 'a split needs a ratio';
  end if;

  if p_price is null or p_price <= 0 then
    raise exception 'a split needs the price a fraction of a share is paid at';
  end if;

  insert into public.symbol_splits
    (symbol, effective_on, numerator, denominator, price)
  values
    (upper(p_symbol), p_effective_on, p_numerator, p_denominator, p_price)
  on conflict (symbol, effective_on) do nothing
  returning * into ledger;

  -- Somebody else applied it. Hand back what they wrote rather than doing it
  -- again: this is the guarantee, not an optimisation.
  if ledger.symbol is null then
    select * into ledger from public.symbol_splits
    where symbol = upper(p_symbol) and effective_on = p_effective_on;
    return ledger;
  end if;

  ratio := p_numerator / p_denominator;

  -- The moment the new count is real: the opening bell in New York on the day
  -- it took effect.
  effective_at := (p_effective_on + time '09:30') at time zone 'America/New_York';

  for holding in
    select h.*, p.id as pid
    from public.holdings h
    join public.portfolios p on p.id = h.portfolio_id
    join public.weekly_cycles c on c.id = p.cycle_id
    where h.symbol = upper(p_symbol)
      and c.status = 'open'
    for update of h
  loop
    if exists (
      select 1 from public.trades t
      where t.portfolio_id = holding.pid
        and t.symbol = upper(p_symbol)
        and t.executed_at >= effective_at
    ) then
      skipped := skipped + 1;
      continue;
    end if;

    exact := holding.quantity * ratio;
    kept := trunc(exact);

    if kept < 1 then
      -- A reverse split can leave less than a share. The position becomes the
      -- cash it is worth, which is the only honest thing to do with it.
      update public.portfolios
      set cash = cash + round(exact * p_price, 2)
      where id = holding.pid;

      delete from public.holdings where id = holding.id;
    else
      update public.portfolios
      set cash = cash + round((exact - kept) * p_price, 2)
      where id = holding.pid;

      update public.holdings
      set quantity = kept,
          cost_basis = round(holding.cost_basis * (kept / exact), 2),
          updated_at = now()
      where id = holding.id;
    end if;

    adjusted := adjusted + 1;
  end loop;

  update public.symbol_splits
  set holdings_adjusted = adjusted,
      holdings_skipped = skipped
  where symbol = upper(p_symbol) and effective_on = p_effective_on
  returning * into ledger;

  return ledger;
end;
$$;

revoke all on function public.claim_split_check(date) from public, anon, authenticated;
revoke all on function public.apply_split(text, date, numeric, numeric, numeric)
  from public, anon, authenticated;

grant execute on function public.claim_split_check(date) to service_role;
grant execute on function public.apply_split(text, date, numeric, numeric, numeric) to service_role;
