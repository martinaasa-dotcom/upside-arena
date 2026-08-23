-- Upside Arena: the lineup. What the weekend is for.
--
-- The market shuts at 16:00 on Friday and opens at 09:30 on Monday. That is
-- sixty-five hours, two fifths of the week, in which Arena can do nothing at
-- all: no trade can be placed, no price moves, no standing changes. The app's
-- answer was to say the market is closed and come back Monday.
--
-- Which is a shame, because the weekend is exactly when people talk about it.
-- The week has just been settled, the result is fresh, somebody has been beaten
-- by half a percent and wants to say what they are doing about it. Sending
-- them away at that moment and asking them to remember on Monday morning is
-- how a player who was enjoying themselves on Saturday has a dead week by
-- Wednesday.
--
-- So: a lineup. Over the weekend you say what you want to own, and it is
-- bought for you at Monday's opening price.
--
-- Three properties, and all three are the reason this is fair rather than a
-- head start:
--
--   1. Everybody fills at the same price -- the session open on the Monday --
--      whether they queued it on Friday evening or the app ran the fill on
--      Wednesday because nobody visited. There is no advantage in queueing
--      later and none in opening the app earlier.
--
--   2. It locks when the market opens. After that the price is known, so a
--      lineup that could still be edited would be a trade with hindsight.
--
--   3. It is not a promise the app cannot keep. An order that cannot be
--      priced, or that there is no longer cash for, is recorded as not having
--      run and said so on screen. Silently dropping one would be worse than
--      never offering the feature.

create table public.lineup_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,

  -- The Monday of the week this is for. A date rather than a cycle, because
  -- the week being queued for usually does not exist yet: cycles are made by
  -- the first person to look, and on a Wednesday nobody has looked at next
  -- Monday.
  monday date not null,

  symbol text not null,
  quantity numeric(18, 4) not null,

  created_at timestamptz not null default now(),

  -- Filled in when the week starts and this runs, whatever happened.
  ran_at timestamptz,
  outcome text check (
    outcome in ('filled', 'no_price', 'not_enough_cash', 'refused')
  ),
  fill_price numeric(18, 6),
  -- Why it did not run, in the words the database used. Shown to the player.
  detail text,

  -- One order per name per week. Changing your mind rewrites the order rather
  -- than adding a second one, which is what somebody means by changing it.
  unique (user_id, monday, symbol),

  constraint lineup_orders_quantity_positive check (quantity > 0),
  constraint lineup_orders_whole_shares check (quantity = trunc(quantity)),
  constraint lineup_orders_symbol_shape check (symbol ~ '^[A-Z0-9.\-]{1,12}$')
);

create index lineup_orders_user_week_idx
  on public.lineup_orders (user_id, monday);

comment on table public.lineup_orders is
  'What somebody said at the weekend they wanted to own. Bought at Monday''s opening price, or recorded as not having run.';

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.lineup_orders enable row level security;

create policy "a player reads their own lineup"
  on public.lineup_orders for select
  to authenticated
  using (auth.uid() = user_id);

/*
  And writes none of it, like everything else that ends in a trade.

  A lineup order looks harmless -- it moves no money and it is only an
  intention. What makes it worth the same protection as a trade is the lock: a
  row a player could write directly is a row they could write at 09:31 on
  Monday, once the price is known, and be filled at the open. The whole
  fairness of this feature is one timestamp comparison, so that comparison
  lives in a function only the server may call.
*/

-- ---------------------------------------------------------------------------
-- queue_lineup_order
-- ---------------------------------------------------------------------------
-- p_locked is worked out by the caller, which is the only party that knows
-- what time it is in New York, exactly as due_cycles takes today's date.

create or replace function public.queue_lineup_order(
  p_user_id uuid,
  p_monday date,
  p_symbol text,
  p_quantity numeric,
  p_locked boolean,
  p_max_orders integer default 8
)
returns public.lineup_orders
language plpgsql
security definer
set search_path = public
as $$
declare
  order_row public.lineup_orders;
  queued integer;
begin
  if p_locked then
    raise exception 'the lineup for this week is locked';
  end if;

  if p_quantity is null or p_quantity <= 0 or p_quantity <> trunc(p_quantity) then
    raise exception 'quantity must be a whole number of shares';
  end if;

  select count(*) into queued
  from public.lineup_orders
  where user_id = p_user_id and monday = p_monday and symbol <> upper(btrim(p_symbol));

  if queued >= p_max_orders then
    raise exception 'lineup is full';
  end if;

  insert into public.lineup_orders (user_id, monday, symbol, quantity)
  values (p_user_id, p_monday, upper(btrim(p_symbol)), p_quantity)
  on conflict (user_id, monday, symbol) do update
  set quantity = excluded.quantity,
      created_at = now(),
      ran_at = null,
      outcome = null,
      fill_price = null,
      detail = null
  returning * into order_row;

  return order_row;
end;
$$;

-- ---------------------------------------------------------------------------
-- clear_lineup_order
-- ---------------------------------------------------------------------------

create or replace function public.clear_lineup_order(
  p_user_id uuid,
  p_order_id uuid,
  p_locked boolean
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  removed integer;
begin
  if p_locked then
    raise exception 'the lineup for this week is locked';
  end if;

  delete from public.lineup_orders
  where id = p_order_id and user_id = p_user_id and ran_at is null;

  get diagnostics removed = row_count;
  return removed > 0;
end;
$$;

-- ---------------------------------------------------------------------------
-- fill_lineup
-- ---------------------------------------------------------------------------
/*
  Runs the whole of somebody's lineup for one week, in one transaction.

  Done here rather than in the application for the reason every other write in
  this schema is: an application that claims an order, places the trade and
  then records the outcome has three moments to die in, and each of them
  leaves a player looking at a lineup that does not describe what happened to
  their money.

  Each order gets its own block, so one that cannot be afforded is recorded as
  such and the rest still run. The subtransaction that costs is the point:
  without it a single failure rolls back the ones that already worked.

  Orders run oldest first. When the cash runs out it therefore runs out at the
  end of the list, in the order they were added, which is the only ordering a
  player can predict -- and the screen says so before they queue anything.

  Idempotent. Only orders that have not run are considered, and an order is
  marked as having run in the same transaction as the trade it caused, so
  there is no window in which it could run twice.
*/
create or replace function public.fill_lineup(
  p_user_id uuid,
  p_cycle_id uuid,
  p_monday date,
  p_prices jsonb,
  p_today date default null
)
returns setof public.lineup_orders
language plpgsql
security definer
set search_path = public
as $$
declare
  order_row public.lineup_orders;
  price numeric(18, 6);
begin
  for order_row in
    select *
    from public.lineup_orders
    where user_id = p_user_id and monday = p_monday and ran_at is null
    order by created_at asc, symbol asc
    for update
  loop
    price := nullif(p_prices ->> order_row.symbol, '')::numeric;

    if price is null or price <= 0 then
      update public.lineup_orders
      set ran_at = now(),
          outcome = 'no_price',
          detail = 'We had no opening price for ' || order_row.symbol || ' that morning.'
      where id = order_row.id
      returning * into order_row;

      return next order_row;
      continue;
    end if;

    begin
      perform public.execute_trade(
        p_user_id, p_cycle_id, order_row.symbol, 'buy',
        order_row.quantity, price, 2147483647, 2147483647, p_today
      );

      update public.lineup_orders
      set ran_at = now(),
          outcome = 'filled',
          fill_price = price,
          detail = null
      where id = order_row.id
      returning * into order_row;
    exception
      when others then
        update public.lineup_orders
        set ran_at = now(),
            outcome = case
              when sqlerrm like '%not enough cash%' then 'not_enough_cash'
              else 'refused'
            end,
            fill_price = price,
            detail = sqlerrm
        where id = order_row.id
        returning * into order_row;
    end;

    return next order_row;
  end loop;
end;
$$;

/*
  The trade limits are handed the largest integer there is rather than the
  usual ten a minute.

  Those limits exist to stop a script working a leaderboard by clicking faster
  than a person can. This is the server filling eight orders it was given days
  ago, inside one transaction, at a price nobody could have known when they
  were placed. Applying a rate limit to it would mean a lineup of eight
  silently losing its last two, which is precisely the failure this whole
  feature is built not to have.
*/

revoke all on function public.queue_lineup_order(uuid, date, text, numeric, boolean, integer)
  from public, anon, authenticated;
revoke all on function public.clear_lineup_order(uuid, uuid, boolean)
  from public, anon, authenticated;
revoke all on function public.fill_lineup(uuid, uuid, date, jsonb, date)
  from public, anon, authenticated;

grant execute on function public.queue_lineup_order(uuid, date, text, numeric, boolean, integer) to service_role;
grant execute on function public.clear_lineup_order(uuid, uuid, boolean) to service_role;
grant execute on function public.fill_lineup(uuid, uuid, date, jsonb, date) to service_role;
