-- Tests for the phase 2 portfolio engine: cycles, cash, holdings, trades,
-- the rate limiter and end-of-week scoring.
--
-- Run with scripts/test-db.sh.

\set ON_ERROR_STOP on
\o /dev/null

-- Two players, and a week to play.
insert into auth.users (id, email, raw_user_meta_data)
values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'ana@example.com', '{}'::jsonb),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'ben@example.com', '{}'::jsonb);

-- ---------------------------------------------------------------------------
-- Cycles
-- ---------------------------------------------------------------------------

select public.ensure_cycle('2026-08-17', 100000, 776.18);

select public.assert(
  (select count(*) from public.weekly_cycles) = 1,
  'a week is created on first sight'
);

select public.assert(
  (select starting_balance from public.weekly_cycles where monday = '2026-08-17') = 100000,
  'the week records the starting balance everyone gets'
);

-- Asking again must not create a second week, or two servers racing on Monday
-- morning would split the players across duplicate weeks.
select public.ensure_cycle('2026-08-17', 100000, 776.18);

select public.assert(
  (select count(*) from public.weekly_cycles) = 1,
  'asking for the same week twice returns the same week'
);

-- ---------------------------------------------------------------------------
-- Portfolios
-- ---------------------------------------------------------------------------

select public.ensure_portfolio(
  'aaaaaaaa-0000-0000-0000-000000000001',
  (select id from public.weekly_cycles where monday = '2026-08-17')
);
select public.ensure_portfolio(
  'bbbbbbbb-0000-0000-0000-000000000002',
  (select id from public.weekly_cycles where monday = '2026-08-17')
);

select public.assert(
  (select count(*) from public.portfolios) = 2,
  'every player gets their own portfolio for the week'
);

select public.assert(
  (select count(distinct cash) from public.portfolios) = 1
    and (select min(cash) from public.portfolios) = 100000,
  'everyone starts the week with the same cash, which is what makes it a race'
);

-- ---------------------------------------------------------------------------
-- Buying
-- ---------------------------------------------------------------------------

select public.execute_trade(
  'aaaaaaaa-0000-0000-0000-000000000001',
  (select id from public.weekly_cycles where monday = '2026-08-17'),
  'AAPL', 'buy', 100, 311.00
);

select public.assert(
  (select cash from public.portfolios
   where user_id = 'aaaaaaaa-0000-0000-0000-000000000001') = 100000 - 31100,
  'buying takes the cost out of cash'
);

select public.assert(
  (select quantity from public.holdings h
   join public.portfolios p on p.id = h.portfolio_id
   where p.user_id = 'aaaaaaaa-0000-0000-0000-000000000001' and h.symbol = 'AAPL') = 100,
  'buying creates the holding'
);

select public.assert(
  (select cost_basis from public.holdings h
   join public.portfolios p on p.id = h.portfolio_id
   where p.user_id = 'aaaaaaaa-0000-0000-0000-000000000001' and h.symbol = 'AAPL') = 31100,
  'the holding records what was paid for it'
);

-- Buying more of the same name adds to the position rather than making a
-- second row, so a portfolio shows one line per company.
select public.execute_trade(
  'aaaaaaaa-0000-0000-0000-000000000001',
  (select id from public.weekly_cycles where monday = '2026-08-17'),
  'AAPL', 'buy', 50, 320.00
);

select public.assert(
  (select count(*) from public.holdings h
   join public.portfolios p on p.id = h.portfolio_id
   where p.user_id = 'aaaaaaaa-0000-0000-0000-000000000001') = 1,
  'buying the same name twice keeps one holding'
);

select public.assert(
  (select quantity from public.holdings h
   join public.portfolios p on p.id = h.portfolio_id
   where p.user_id = 'aaaaaaaa-0000-0000-0000-000000000001' and h.symbol = 'AAPL') = 150,
  'the position grows by the shares bought'
);

select public.assert(
  (select cost_basis from public.holdings h
   join public.portfolios p on p.id = h.portfolio_id
   where p.user_id = 'aaaaaaaa-0000-0000-0000-000000000001' and h.symbol = 'AAPL') = 31100 + 16000,
  'cost basis adds up across buys at different prices'
);

-- ---------------------------------------------------------------------------
-- Cash is real: you cannot spend what you do not have
-- ---------------------------------------------------------------------------

do $$
begin
  begin
    perform public.execute_trade(
      'bbbbbbbb-0000-0000-0000-000000000002',
      (select id from public.weekly_cycles where monday = '2026-08-17'),
      'MSFT', 'buy', 1000, 500.00   -- 500,000 against 100,000 of cash
    );
    raise exception 'FAILED: a player spent cash they did not have';
  exception
    when others then
      if sqlerrm like '%not enough cash%' then
        raise notice 'ok: a player cannot spend more cash than they hold';
      else raise; end if;
  end;
end $$;

select public.assert(
  (select cash from public.portfolios
   where user_id = 'bbbbbbbb-0000-0000-0000-000000000002') = 100000,
  'a refused trade leaves cash untouched'
);

-- ---------------------------------------------------------------------------
-- Selling
-- ---------------------------------------------------------------------------

do $$
begin
  begin
    perform public.execute_trade(
      'bbbbbbbb-0000-0000-0000-000000000002',
      (select id from public.weekly_cycles where monday = '2026-08-17'),
      'AAPL', 'sell', 10, 311.00
    );
    raise exception 'FAILED: a player sold shares they never owned';
  exception
    when others then
      if sqlerrm like '%do not own%' then
        raise notice 'ok: a player cannot sell shares they do not own';
      else raise; end if;
  end;
end $$;

-- Selling part of a position takes cost basis out in proportion.
select public.execute_trade(
  'aaaaaaaa-0000-0000-0000-000000000001',
  (select id from public.weekly_cycles where monday = '2026-08-17'),
  'AAPL', 'sell', 50, 330.00
);

select public.assert(
  (select quantity from public.holdings h
   join public.portfolios p on p.id = h.portfolio_id
   where p.user_id = 'aaaaaaaa-0000-0000-0000-000000000001' and h.symbol = 'AAPL') = 100,
  'selling reduces the position'
);

select public.assert(
  (select cash from public.portfolios
   where user_id = 'aaaaaaaa-0000-0000-0000-000000000001')
   = 100000 - 31100 - 16000 + 16500,
  'selling puts the proceeds back into cash'
);

-- 47,100 paid for 150 shares. Selling a third removes a third of the cost.
select public.assert(
  (select cost_basis from public.holdings h
   join public.portfolios p on p.id = h.portfolio_id
   where p.user_id = 'aaaaaaaa-0000-0000-0000-000000000001' and h.symbol = 'AAPL') = 47100 - 15700,
  'cost basis leaves in the same proportion as the shares'
);

-- Selling everything closes the position rather than leaving an empty row.
select public.execute_trade(
  'aaaaaaaa-0000-0000-0000-000000000001',
  (select id from public.weekly_cycles where monday = '2026-08-17'),
  'AAPL', 'sell', 100, 315.00
);

select public.assert(
  (select count(*) from public.holdings h
   join public.portfolios p on p.id = h.portfolio_id
   where p.user_id = 'aaaaaaaa-0000-0000-0000-000000000001') = 0,
  'selling the last share removes the holding'
);

-- ---------------------------------------------------------------------------
-- What a trade may be
-- ---------------------------------------------------------------------------

do $$
declare
  cycle uuid := (select id from public.weekly_cycles where monday = '2026-08-17');
begin
  begin
    perform public.execute_trade(
      'bbbbbbbb-0000-0000-0000-000000000002', cycle, 'MSFT', 'buy', 1.5, 100
    );
    raise exception 'FAILED: a fractional share was accepted';
  exception when others then
    if sqlerrm like '%whole number%' then
      raise notice 'ok: only whole shares can be traded';
    else raise; end if;
  end;

  begin
    perform public.execute_trade(
      'bbbbbbbb-0000-0000-0000-000000000002', cycle, 'MSFT', 'buy', -5, 100
    );
    raise exception 'FAILED: a negative quantity was accepted';
  exception when others then
    if sqlerrm like '%whole number%' then
      raise notice 'ok: a negative quantity is refused';
    else raise; end if;
  end;

  begin
    perform public.execute_trade(
      'bbbbbbbb-0000-0000-0000-000000000002', cycle, 'MSFT', 'buy', 5, 0
    );
    raise exception 'FAILED: a zero price was accepted';
  exception when others then
    if sqlerrm like '%price must be positive%' then
      raise notice 'ok: a trade needs a real price';
    else raise; end if;
  end;

  begin
    perform public.execute_trade(
      'bbbbbbbb-0000-0000-0000-000000000002', cycle, 'MSFT', 'short', 5, 100
    );
    raise exception 'FAILED: an unknown side was accepted';
  exception when others then
    if sqlerrm like '%buy or sell%' then
      raise notice 'ok: only buying and selling exist in this game';
    else raise; end if;
  end;
end $$;

-- ---------------------------------------------------------------------------
-- Rate limiting, the anti-cheat layer
-- ---------------------------------------------------------------------------

do $$
declare
  cycle uuid := (select id from public.weekly_cycles where monday = '2026-08-17');
  i integer;
begin
  -- Three allowed, the fourth refused.
  for i in 1..3 loop
    perform public.execute_trade(
      'bbbbbbbb-0000-0000-0000-000000000002', cycle, 'MSFT', 'buy', 1, 100,
      3, 500
    );
  end loop;

  begin
    perform public.execute_trade(
      'bbbbbbbb-0000-0000-0000-000000000002', cycle, 'MSFT', 'buy', 1, 100,
      3, 500
    );
    raise exception 'FAILED: a script traded past the per-minute limit';
  exception when others then
    if sqlerrm like '%slow down%' then
      raise notice 'ok: trading faster than a person can click is refused';
    else raise; end if;
  end;
end $$;

-- ---------------------------------------------------------------------------
-- A closed week stays closed
-- ---------------------------------------------------------------------------

insert into public.weekly_cycles (monday, starting_balance, benchmark_open, status)
values ('2026-08-10', 100000, 770.00, 'closed');

do $$
begin
  begin
    perform public.execute_trade(
      'aaaaaaaa-0000-0000-0000-000000000001',
      (select id from public.weekly_cycles where monday = '2026-08-10'),
      'AAPL', 'buy', 1, 300
    );
    raise exception 'FAILED: a settled week accepted a new trade';
  exception when others then
    if sqlerrm like '%closed for trading%' then
      raise notice 'ok: a week that has been scored cannot be traded again';
    else raise; end if;
  end;
end $$;

-- ---------------------------------------------------------------------------
-- Scoring
-- ---------------------------------------------------------------------------

insert into public.weekly_cycles (monday, starting_balance, benchmark_open)
values ('2026-08-24', 100000, 800.00);

select public.ensure_portfolio(
  'aaaaaaaa-0000-0000-0000-000000000001',
  (select id from public.weekly_cycles where monday = '2026-08-24')
);
select public.ensure_portfolio(
  'bbbbbbbb-0000-0000-0000-000000000002',
  (select id from public.weekly_cycles where monday = '2026-08-24')
);

-- Ana buys 100 shares at 200. Ben stays in cash.
select public.execute_trade(
  'aaaaaaaa-0000-0000-0000-000000000001',
  (select id from public.weekly_cycles where monday = '2026-08-24'),
  'NVDA', 'buy', 100, 200.00
);

-- NVDA closes at 240, so Ana's 20,000 became 24,000: up 4% overall.
-- The benchmark went 800 to 808, up 1%.
select public.score_cycle(
  (select id from public.weekly_cycles where monday = '2026-08-24'),
  '{"NVDA": 240}'::jsonb,
  808.00
);

select public.assert(
  (select final_value from public.portfolios p
   join public.weekly_cycles c on c.id = p.cycle_id
   where p.user_id = 'aaaaaaaa-0000-0000-0000-000000000001' and c.monday = '2026-08-24')
   = 104000,
  'a portfolio is valued as cash plus what the holdings closed at'
);

select public.assert(
  (select return_percent from public.portfolios p
   join public.weekly_cycles c on c.id = p.cycle_id
   where p.user_id = 'aaaaaaaa-0000-0000-0000-000000000001' and c.monday = '2026-08-24')
   = 4.0000,
  'the week scores as percent return on the starting balance'
);

select public.assert(
  (select benchmark_diff from public.portfolios p
   join public.weekly_cycles c on c.id = p.cycle_id
   where p.user_id = 'aaaaaaaa-0000-0000-0000-000000000001' and c.monday = '2026-08-24')
   = 3.0000,
  'beating the market by three points is recorded as three points'
);

-- Cash earns nothing, exactly as it would in life. Ben finishes flat and so
-- loses to a rising market.
select public.assert(
  (select return_percent from public.portfolios p
   join public.weekly_cycles c on c.id = p.cycle_id
   where p.user_id = 'bbbbbbbb-0000-0000-0000-000000000002' and c.monday = '2026-08-24')
   = 0.0000,
  'money left in cash earns nothing'
);

select public.assert(
  (select benchmark_diff from public.portfolios p
   join public.weekly_cycles c on c.id = p.cycle_id
   where p.user_id = 'bbbbbbbb-0000-0000-0000-000000000002' and c.monday = '2026-08-24')
   = -1.0000,
  'sitting in cash while the market rises counts as falling behind it'
);

select public.assert(
  (select status from public.weekly_cycles where monday = '2026-08-24') = 'closed',
  'scoring closes the week'
);

-- Scoring twice must land on the same numbers, so retrying a failed job is safe.
update public.weekly_cycles set status = 'open' where monday = '2026-08-24';
select public.score_cycle(
  (select id from public.weekly_cycles where monday = '2026-08-24'),
  '{"NVDA": 240}'::jsonb,
  808.00
);

select public.assert(
  (select return_percent from public.portfolios p
   join public.weekly_cycles c on c.id = p.cycle_id
   where p.user_id = 'aaaaaaaa-0000-0000-0000-000000000001' and c.monday = '2026-08-24')
   = 4.0000,
  'scoring a week twice produces the same result'
);

-- ---------------------------------------------------------------------------
-- Row level security: a player reads their own game and writes none of it
-- ---------------------------------------------------------------------------

begin;
  set local request.jwt.claims = '{"sub": "aaaaaaaa-0000-0000-0000-000000000001"}';
  set local role authenticated;

  select public.assert(
    (select count(*) from public.portfolios) = 2,
    'a player sees only their own portfolios'
  );

  select public.assert(
    (select count(*) from public.trades) > 0,
    'a player can read their own trades'
  );

  select public.assert(
    (select count(*) from public.trades t
     join public.portfolios p on p.id = t.portfolio_id
     where p.user_id <> 'aaaaaaaa-0000-0000-0000-000000000001') = 0,
    'a player cannot read another player''s trades'
  );

  select public.assert(
    (select count(*) from public.weekly_cycles) > 0,
    'the week itself is readable by any signed-in player'
  );
commit;

-- The important one. Even holding a valid session, a player must not be able
-- to write their own cash, holdings or trades.
do $$
declare
  pid uuid := (select id from public.portfolios
               where user_id = 'aaaaaaaa-0000-0000-0000-000000000001' limit 1);
begin
  perform set_config(
    'request.jwt.claims',
    '{"sub": "aaaaaaaa-0000-0000-0000-000000000001"}', true
  );
  set local role authenticated;

  begin
    update public.portfolios set cash = 999999 where id = pid;
    if found then
      raise exception 'FAILED: a player handed themselves cash';
    end if;
    raise notice 'ok: a player cannot write their own cash';
  exception
    when insufficient_privilege then
      raise notice 'ok: a player cannot write their own cash';
  end;

  begin
    insert into public.trades (portfolio_id, symbol, side, quantity, price, value)
    values (pid, 'FAKE', 'buy', 1, 1, 1);
    raise exception 'FAILED: a player wrote their own trade';
  exception
    when insufficient_privilege then
      raise notice 'ok: a player cannot write their own trades';
  end;

  begin
    insert into public.holdings (portfolio_id, symbol, quantity, cost_basis)
    values (pid, 'FAKE', 1000, 0);
    raise exception 'FAILED: a player handed themselves shares';
  exception
    when insufficient_privilege then
      raise notice 'ok: a player cannot hand themselves shares';
  end;

  begin
    perform public.execute_trade(
      'aaaaaaaa-0000-0000-0000-000000000001',
      (select id from public.weekly_cycles where monday = '2026-08-17'),
      'AAPL', 'buy', 1, 0.01
    );
    raise exception 'FAILED: a player called the trade function directly';
  exception
    when insufficient_privilege then
      raise notice 'ok: a player cannot call the trade function directly';
  end;
end $$;

-- ---------------------------------------------------------------------------
-- Deleting an account takes the game with it
-- ---------------------------------------------------------------------------

delete from auth.users where id = 'aaaaaaaa-0000-0000-0000-000000000001';

select public.assert(
  (select count(*) from public.portfolios
   where user_id = 'aaaaaaaa-0000-0000-0000-000000000001') = 0,
  'closing an account erases its portfolios'
);

select public.assert(
  (select count(*) from public.trades t
   left join public.portfolios p on p.id = t.portfolio_id
   where p.id is null) = 0,
  'no trade is left behind pointing at a portfolio that no longer exists'
);
