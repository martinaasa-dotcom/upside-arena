-- The lineup: what somebody said at the weekend they wanted to own on Monday.
--
-- The whole fairness of this feature is one comparison -- has the market
-- opened on the week being queued for? -- and one guarantee: nothing is
-- dropped quietly. Both are here.
--
-- Note what is not here. The caller works out whether the week has begun,
-- because it is the only party that knows what time it is in New York, so
-- these tests hand the answer in exactly as the application does.

\set ON_ERROR_STOP on
\o /dev/null

insert into auth.users (id, email, raw_user_meta_data)
values ('aaaaaaaa-0000-0000-0000-000000000001', 'ana@example.com', '{}'::jsonb);

select public.ensure_cycle('2026-08-24', 100000, 780.00);

-- ---------------------------------------------------------------------------
-- Queueing
-- ---------------------------------------------------------------------------

select public.queue_lineup_order(
  'aaaaaaaa-0000-0000-0000-000000000001', '2026-08-24', 'aapl', 100,
  '2026-08-22', false, 8
);

select public.assert(
  (select symbol from public.lineup_orders) = 'AAPL',
  'a name is stored the way every other symbol in this schema is'
);

-- Changing your mind rewrites the order rather than adding a second one,
-- which is what somebody means by changing it.
select public.queue_lineup_order(
  'aaaaaaaa-0000-0000-0000-000000000001', '2026-08-24', 'AAPL', 50,
  '2026-08-22', false, 8
);

select public.assert(
  (select count(*) from public.lineup_orders) = 1
    and (select quantity from public.lineup_orders) = 50,
  'queueing the same name again changes it rather than adding another'
);

do $$
begin
  perform public.queue_lineup_order(
    'aaaaaaaa-0000-0000-0000-000000000001', '2026-08-24', 'MSFT', 10.5,
    '2026-08-22', false, 8
  );
  raise exception 'should not reach here';
exception
  when others then
    perform public.assert(
      sqlerrm like '%whole number%',
      'a lineup is whole shares, like everything else in this game'
    );
end
$$;

-- A lineup is a decision, not a portfolio.
do $$
declare
  name text;
begin
  foreach name in array array['MSFT', 'NVDA', 'GOOGL', 'AMZN', 'META', 'TSLA', 'SPY']
  loop
    perform public.queue_lineup_order(
      'aaaaaaaa-0000-0000-0000-000000000001', '2026-08-24', name, 1,
      '2026-08-22', false, 8
    );
  end loop;

  begin
    perform public.queue_lineup_order(
      'aaaaaaaa-0000-0000-0000-000000000001', '2026-08-24', 'INTC', 1,
      '2026-08-22', false, 8
    );
    raise exception 'should not reach here';
  exception
    when others then
      perform public.assert(sqlerrm like '%lineup is full%', 'a lineup holds eight names');
  end;

  -- But replacing one of the eight is not adding a ninth.
  perform public.queue_lineup_order(
    'aaaaaaaa-0000-0000-0000-000000000001', '2026-08-24', 'SPY', 4,
    '2026-08-22', false, 8
  );
  perform public.assert(
    (select count(*) from public.lineup_orders) = 8,
    'and changing one of the eight is not adding a ninth'
  );
end
$$;

-- ---------------------------------------------------------------------------
-- The lock
-- ---------------------------------------------------------------------------
-- From the bell the opening price exists, so an order that could still be
-- changed would be a trade placed with hindsight. This is the entire
-- fairness of the feature.

do $$
begin
  -- The Monday itself, after the bell.
  perform public.queue_lineup_order(
    'aaaaaaaa-0000-0000-0000-000000000001', '2026-08-24', 'INTC', 1,
    '2026-08-24', true, 8
  );
  raise exception 'should not reach here';
exception
  when others then
    perform public.assert(sqlerrm like '%locked%', 'nothing can be added once the week has begun');
end
$$;

do $$
declare
  order_id uuid := (select id from public.lineup_orders where symbol = 'AAPL');
begin
  begin
    perform public.clear_lineup_order(
      'aaaaaaaa-0000-0000-0000-000000000001', order_id, '2026-08-24', true
    );
    raise exception 'should not reach here';
  exception
    when others then
      perform public.assert(
        sqlerrm like '%locked%',
        'and nothing can be taken out either'
      );
  end;

  perform public.assert(
    public.clear_lineup_order(
      'aaaaaaaa-0000-0000-0000-000000000001', order_id, '2026-08-24', false
    ),
    'before the bell, it can be taken out'
  );

  -- Somebody else's order is not theirs to remove, whatever they know about
  -- the id.
  perform public.assert(
    public.clear_lineup_order(
      'bbbbbbbb-0000-0000-0000-000000000002',
      (select id from public.lineup_orders limit 1),
      '2026-08-22', false
    ) = false,
    'and only by the person whose lineup it is'
  );
end
$$;

-- ---------------------------------------------------------------------------
-- Running it
-- ---------------------------------------------------------------------------

-- Start again, with a lineup that will not all fit: two affordable names, one
-- that cannot be priced, and one there will be no cash left for.
delete from public.lineup_orders where true;

select public.queue_lineup_order(
  'aaaaaaaa-0000-0000-0000-000000000001', '2026-08-24', 'AAPL', 100,
  '2026-08-22', false, 8
);
select public.queue_lineup_order(
  'aaaaaaaa-0000-0000-0000-000000000001', '2026-08-24', 'GONE', 10,
  '2026-08-22', false, 8
);
select public.queue_lineup_order(
  'aaaaaaaa-0000-0000-0000-000000000001', '2026-08-24', 'MSFT', 100,
  '2026-08-22', false, 8
);
select public.queue_lineup_order(
  'aaaaaaaa-0000-0000-0000-000000000001', '2026-08-24', 'NVDA', 1000,
  '2026-08-22', false, 8
);

do $$
declare
  cycle_id uuid := (select id from public.weekly_cycles where league_id is null);
begin
  perform public.fill_lineup(
    'aaaaaaaa-0000-0000-0000-000000000001',
    cycle_id,
    '2026-08-24',
    '{"AAPL": 200, "MSFT": 400, "NVDA": 500}'::jsonb,
    '2026-08-24'
  );
end
$$;

select public.assert(
  (select outcome from public.lineup_orders where symbol = 'AAPL') = 'filled'
    and (select outcome from public.lineup_orders where symbol = 'MSFT') = 'filled',
  'what could be bought was bought'
);

select public.assert(
  (select cash from public.portfolios
   where user_id = 'aaaaaaaa-0000-0000-0000-000000000001') = 40000,
  'at the opening price it was handed, and nothing else'
);

-- Nothing is dropped quietly. A feature that swallows an order is worse than
-- no feature.
select public.assert(
  (select outcome from public.lineup_orders where symbol = 'GONE') = 'no_price',
  'a name with no opening price is recorded as not having run'
);

select public.assert(
  (select detail from public.lineup_orders where symbol = 'GONE') like '%GONE%',
  'and says which one, in words a player can read'
);

select public.assert(
  (select outcome from public.lineup_orders where symbol = 'NVDA') = 'not_enough_cash',
  'and one there was no longer cash for says so rather than vanishing'
);

select public.assert(
  (select count(*) from public.lineup_orders where ran_at is null) = 0,
  'every order has run, whatever came of it'
);

-- ---------------------------------------------------------------------------
-- Running it twice
-- ---------------------------------------------------------------------------
-- The fill happens in the background of whichever request notices first, and
-- two can notice at once. Buying somebody's lineup twice would spend their
-- week for them.

do $$
declare
  cycle_id uuid := (select id from public.weekly_cycles where league_id is null);
begin
  perform public.fill_lineup(
    'aaaaaaaa-0000-0000-0000-000000000001',
    cycle_id,
    '2026-08-24',
    '{"AAPL": 200, "MSFT": 400, "NVDA": 500}'::jsonb,
    '2026-08-24'
  );
end
$$;

select public.assert(
  (select cash from public.portfolios
   where user_id = 'aaaaaaaa-0000-0000-0000-000000000001') = 40000,
  'running a lineup a second time buys nothing again'
);

select public.assert(
  (select count(*) from public.trades t
   join public.portfolios p on p.id = t.portfolio_id
   where p.user_id = 'aaaaaaaa-0000-0000-0000-000000000001') = 2,
  'and leaves two trades, not four'
);


-- ---------------------------------------------------------------------------
-- The lock is about the week the order is for
-- ---------------------------------------------------------------------------
/*
  This is the check the application could not make, and did not.

  It worked the week out with the same function that decides where a *new*
  order goes -- which by construction returns the earliest week that is not
  locked -- so the lock was passed as false for every order it ever guarded,
  including one for a week whose opening price was already public.

  The database has the order, and the order knows its own week. All it is told
  is the date and whether the bell has gone.
*/

insert into auth.users (id, email)
values ('dddd4444-0000-0000-0000-000000000004', 'raul@example.com');

select public.queue_lineup_order(
  'dddd4444-0000-0000-0000-000000000004', '2026-08-24', 'AAPL', 10,
  '2026-08-23', false, 8
);

do $$
declare
  order_id uuid := (
    select id from public.lineup_orders
    where user_id = 'dddd4444-0000-0000-0000-000000000004'
  );
begin
  -- Monday, after the bell. The opening price is public, so this order is
  -- exactly the one somebody would want to take back.
  begin
    perform public.clear_lineup_order(
      'dddd4444-0000-0000-0000-000000000004', order_id, '2026-08-24', true
    );
    raise exception 'should not reach here';
  exception
    when others then
      perform public.assert(
        sqlerrm like '%locked%',
        'an order for a week that has opened cannot be taken back, whatever the caller thinks'
      );
  end;

  -- And later in the week, which is the same answer for the same reason.
  begin
    perform public.clear_lineup_order(
      'dddd4444-0000-0000-0000-000000000004', order_id, '2026-08-27', false
    );
    raise exception 'should not reach here';
  exception
    when others then
      perform public.assert(
        sqlerrm like '%locked%',
        'nor once the week is well under way'
      );
  end;

  perform public.assert(
    (select count(*) from public.lineup_orders
     where user_id = 'dddd4444-0000-0000-0000-000000000004') = 1,
    'and the order is still there afterwards'
  );
end
$$;

select public.assert(
  public.lineup_locked('2026-08-24', '2026-08-23', false) = false
  and public.lineup_locked('2026-08-24', '2026-08-24', false) = false
  and public.lineup_locked('2026-08-24', '2026-08-24', true) = true
  and public.lineup_locked('2026-08-24', '2026-08-25', false) = true,
  'the lock is the bell on the day, not midnight before it'
);

-- ---------------------------------------------------------------------------
-- Erasure
-- ---------------------------------------------------------------------------

delete from auth.users where id = 'aaaaaaaa-0000-0000-0000-000000000001';

-- Their rows, not every row. A count over the whole table passes only while
-- this file happens to have one player in it, which is the sort of assertion
-- that goes red for a reason that has nothing to do with what it checks.
select public.assert(
  (select count(*) from public.lineup_orders
   where user_id = 'aaaaaaaa-0000-0000-0000-000000000001') = 0,
  'a lineup goes with the account that left it'
);

\o
