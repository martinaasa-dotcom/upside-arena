-- Share splits: the one thing that changes a position without anybody trading.
--
-- A ten for one leaves a hundred shares as a thousand, each worth a tenth of
-- what it was, and the price Arena reads is the new one from that morning on.
-- A game still holding a hundred shows a player who did nothing a ninety per
-- cent loss and then settles the week on it. A reverse split does the same in
-- the other direction and prints a week nobody traded for.
--
-- What every assertion below is really checking is one property: the position
-- is worth the same money either side of the split, to within the price of a
-- single share, and the difference is paid in cash the way a broker pays it.

\set ON_ERROR_STOP on
\o /dev/null

insert into auth.users (id, email, raw_user_meta_data)
values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'ana@example.com', '{}'::jsonb),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'ben@example.com', '{}'::jsonb);

-- The week everybody is playing, and the one that is already history.
insert into public.weekly_cycles (id, monday, status, starting_balance, benchmark_open)
values
  ('55550000-0000-0000-0000-00000000aaaa', current_date, 'open', 100000, 100),
  ('55550000-0000-0000-0000-00000000bbbb', current_date - 7, 'closed', 100000, 100);

select public.ensure_portfolio(
  'aaaaaaaa-0000-0000-0000-000000000001', '55550000-0000-0000-0000-00000000aaaa');
select public.ensure_portfolio(
  'bbbbbbbb-0000-0000-0000-000000000002', '55550000-0000-0000-0000-00000000aaaa');
select public.ensure_portfolio(
  'aaaaaaaa-0000-0000-0000-000000000001', '55550000-0000-0000-0000-00000000bbbb');

-- ---------------------------------------------------------------------------
-- Ten for one
-- ---------------------------------------------------------------------------
-- 100 shares at 200 is 20,000 of the 100,000. After a ten for one the price
-- is 20 and the holding is a thousand shares, which is the same 20,000.

select public.execute_trade(
  'aaaaaaaa-0000-0000-0000-000000000001', '55550000-0000-0000-0000-00000000aaaa',
  'NVDA', 'buy', 100, 200);

select public.apply_split('NVDA', current_date, 10, 1, 20);

select public.assert(
  (select quantity from public.holdings h
   join public.portfolios p on p.id = h.portfolio_id
   where h.symbol = 'NVDA'
     and p.user_id = 'aaaaaaaa-0000-0000-0000-000000000001'
     and p.cycle_id = '55550000-0000-0000-0000-00000000aaaa') = 1000,
  'a ten for one leaves ten times the shares'
);

select public.assert(
  (select cost_basis from public.holdings h
   join public.portfolios p on p.id = h.portfolio_id
   where h.symbol = 'NVDA'
     and p.user_id = 'aaaaaaaa-0000-0000-0000-000000000001'
     and p.cycle_id = '55550000-0000-0000-0000-00000000aaaa') = 20000,
  'and the same money in it, so the average cost falls by the ratio'
);

select public.assert(
  (select cash from public.portfolios
   where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'
     and cycle_id = '55550000-0000-0000-0000-00000000aaaa') = 80000,
  'and nothing paid out, because ten for one divides evenly'
);

-- ---------------------------------------------------------------------------
-- Applying it twice applies it once
-- ---------------------------------------------------------------------------
-- The whole point of the ledger. Any number of workers can notice the same
-- split at the same moment.

select public.apply_split('NVDA', current_date, 10, 1, 20);
select public.apply_split('NVDA', current_date, 10, 1, 20);

select public.assert(
  (select quantity from public.holdings h
   join public.portfolios p on p.id = h.portfolio_id
   where h.symbol = 'NVDA'
     and p.user_id = 'aaaaaaaa-0000-0000-0000-000000000001'
     and p.cycle_id = '55550000-0000-0000-0000-00000000aaaa') = 1000,
  'a split applied three times is applied once'
);

select public.assert(
  (select holdings_adjusted from public.symbol_splits
   where symbol = 'NVDA' and effective_on = current_date) = 1,
  'and the ledger still says it moved one holding'
);

-- ---------------------------------------------------------------------------
-- A fraction of a share is paid out in cash
-- ---------------------------------------------------------------------------
-- Whole shares only, so three for two on an odd number cannot come out even.
-- 101 shares at 100 becomes 151 at 66.6667 plus half a share in cash, and the
-- position is worth what it was.

select public.execute_trade(
  'bbbbbbbb-0000-0000-0000-000000000002', '55550000-0000-0000-0000-00000000aaaa',
  'ODDS', 'buy', 101, 100);

select public.apply_split('ODDS', current_date, 3, 2, 66.6667);

select public.assert(
  (select quantity from public.holdings h
   join public.portfolios p on p.id = h.portfolio_id
   where h.symbol = 'ODDS'
     and p.user_id = 'bbbbbbbb-0000-0000-0000-000000000002') = 151,
  'the whole shares are kept'
);

select public.assert(
  (select round(cash, 2) from public.portfolios
   where user_id = 'bbbbbbbb-0000-0000-0000-000000000002'
     and cycle_id = '55550000-0000-0000-0000-00000000aaaa') = 89933.33,
  'and the half share left over is paid in cash at the price after the split'
);

select public.assert(
  (select round(p.cash + h.quantity * 66.6667, 0)
   from public.portfolios p
   join public.holdings h on h.portfolio_id = p.id and h.symbol = 'ODDS'
   where p.user_id = 'bbbbbbbb-0000-0000-0000-000000000002') = 100000,
  'so the portfolio is worth what it was worth before the split'
);

-- ---------------------------------------------------------------------------
-- A reverse split that leaves less than a share
-- ---------------------------------------------------------------------------
-- Five shares one for ten is half a share, which nobody can hold. The
-- position becomes the money it is worth.

select public.execute_trade(
  'bbbbbbbb-0000-0000-0000-000000000002', '55550000-0000-0000-0000-00000000aaaa',
  'TINY', 'buy', 5, 100);

select public.apply_split('TINY', current_date, 1, 10, 1000);

select public.assert(
  (select count(*) from public.holdings h
   join public.portfolios p on p.id = h.portfolio_id
   where h.symbol = 'TINY'
     and p.user_id = 'bbbbbbbb-0000-0000-0000-000000000002') = 0,
  'a position too small to be a share stops being a position'
);

select public.assert(
  (select round(cash, 2) from public.portfolios
   where user_id = 'bbbbbbbb-0000-0000-0000-000000000002'
     and cycle_id = '55550000-0000-0000-0000-00000000aaaa') = 89933.33,
  'and comes back as exactly the money it was worth'
);

-- ---------------------------------------------------------------------------
-- History is not revised
-- ---------------------------------------------------------------------------
-- A closed week has a result. Whatever happens to the company afterwards, the
-- week it was played in already happened.

-- Written straight in rather than traded, because that week stopped taking
-- trades days ago, which is the whole point of it.
insert into public.holdings (portfolio_id, symbol, quantity, cost_basis)
select id, 'PAST', 100, 10000 from public.portfolios
where cycle_id = '55550000-0000-0000-0000-00000000bbbb';

select public.apply_split('PAST', current_date, 4, 1, 25);

select public.assert(
  (select quantity from public.holdings h
   join public.portfolios p on p.id = h.portfolio_id
   where h.symbol = 'PAST') = 100,
  'a holding in a week that is already scored is left exactly as it was'
);

select public.assert(
  (select holdings_adjusted from public.symbol_splits
   where symbol = 'PAST' and effective_on = current_date) = 0,
  'and the ledger says so'
);

-- ---------------------------------------------------------------------------
-- A portfolio that has already traded it since is left alone
-- ---------------------------------------------------------------------------
-- Shares bought after the bell on the day of a split were bought at the new
-- price and are already counted the new way. Multiplying them again would
-- invent shares out of nothing. This is why the check runs in the morning:
-- at that hour nobody has traded yet and this guard has nothing to do.

select public.execute_trade(
  'aaaaaaaa-0000-0000-0000-000000000001', '55550000-0000-0000-0000-00000000aaaa',
  'LATE', 'buy', 100, 50);

-- Dated yesterday, so today's trade counts as having happened after it.
select public.apply_split('LATE', current_date - 1, 2, 1, 25);

select public.assert(
  (select quantity from public.holdings h
   join public.portfolios p on p.id = h.portfolio_id
   where h.symbol = 'LATE') = 100,
  'a portfolio that traded the company after the split keeps its own count'
);

select public.assert(
  (select holdings_skipped from public.symbol_splits
   where symbol = 'LATE' and effective_on = current_date - 1) = 1,
  'and the ledger records that it was passed over rather than adjusted'
);

-- ---------------------------------------------------------------------------
-- The day's claim
-- ---------------------------------------------------------------------------
-- One worker asks the provider what split today. Everybody else gets on with
-- serving pages.

select public.assert(
  public.claim_split_check(current_date) = true,
  'the first caller of the day takes the check'
);

select public.assert(
  public.claim_split_check(current_date) = false,
  'and everybody after it is told it is taken'
);

select public.assert(
  public.claim_split_check(current_date + 1) = true,
  'tomorrow is a different day and a different claim'
);

-- ---------------------------------------------------------------------------
-- A split needs a ratio and a price
-- ---------------------------------------------------------------------------

do $$
begin
  perform public.apply_split('NOPE', current_date, 0, 1, 10);
  perform public.assert(false, 'a split with no ratio is refused');
exception when others then
  perform public.assert(sqlerrm like '%ratio%', 'a split with no ratio is refused');
end;
$$;

do $$
begin
  perform public.apply_split('NOPE', current_date, 2, 1, null);
  perform public.assert(false, 'and so is one with no price to pay a fraction at');
exception when others then
  perform public.assert(
    sqlerrm like '%price%', 'and so is one with no price to pay a fraction at');
end;
$$;

-- ---------------------------------------------------------------------------
-- Nobody but the game may touch any of this
-- ---------------------------------------------------------------------------

begin;
  set local request.jwt.claims = '{"sub": "aaaaaaaa-0000-0000-0000-000000000001"}';
  set local role authenticated;

  do $$
  begin
    perform public.apply_split('NVDA', current_date + 5, 2, 1, 10);
    perform public.assert(false, 'a player cannot split a company');
  exception when insufficient_privilege then
    perform public.assert(true, 'a player cannot split a company');
  end;
  $$;

  do $$
  begin
    perform public.claim_split_check(current_date + 5);
    perform public.assert(false, 'nor claim the day''s check');
  exception when insufficient_privilege then
    perform public.assert(true, 'nor claim the day''s check');
  end;
  $$;

  do $$
  declare
    seen integer;
  begin
    select count(*) into seen from public.symbol_splits;
    perform public.assert(seen = 0, 'nor read the ledger, which is none of their business');
  end;
  $$;
commit;
