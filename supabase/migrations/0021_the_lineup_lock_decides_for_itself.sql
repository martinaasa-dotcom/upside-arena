/*
  The lineup lock could never be true.

  The whole fairness of a lineup is one comparison: has the market opened on
  the week this order is for? Before the bell nobody knows the opening price
  and an order may still be changed; from the bell it exists, and an order
  that could still be changed would be a trade placed with hindsight.

  That comparison was made by the caller and handed in, which was deliberate
  -- the database has no opinion about New York -- and wrong in a way that is
  obvious once seen. The application worked the week out with lineupMonday(),
  which by construction returns the earliest week that is *not* locked. So
  p_locked was false every single time it was ever passed, for every order,
  including one belonging to a week whose opening price was already public.

  Nothing about the screen made that reachable, because the lineup is only
  offered while the market is shut. But clear_lineup_order is a server action,
  and one that will delete a locked order on request is the exact hindsight
  this feature was built not to allow.

  So the database decides. It has the order, the order has the week it is for,
  and the caller supplies only the two facts it alone knows: what today's date
  is in New York, and whether the bell has gone. There is no week for the
  caller to get wrong any more, because it no longer names one.
*/

-- ---------------------------------------------------------------------------
-- locked_for_week
-- ---------------------------------------------------------------------------
-- Said once, so the two functions below cannot drift from each other.

create or replace function public.lineup_locked(
  p_monday date,
  p_today date,
  p_opened boolean
)
returns boolean
language sql
immutable
as $$
  select p_today > p_monday or (p_today = p_monday and coalesce(p_opened, true))
$$;

comment on function public.lineup_locked(date, date, boolean) is
  'Whether a week''s lineup is set. p_opened is whether the market has opened today, which only the caller knows.';

grant execute on function public.lineup_locked(date, date, boolean) to service_role;

-- ---------------------------------------------------------------------------
-- queue_lineup_order, deciding for itself
-- ---------------------------------------------------------------------------

drop function if exists public.queue_lineup_order(uuid, date, text, numeric, boolean, integer);

create or replace function public.queue_lineup_order(
  p_user_id uuid,
  p_monday date,
  p_symbol text,
  p_quantity numeric,
  p_today date,
  p_opened boolean,
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
  if public.lineup_locked(p_monday, p_today, p_opened) then
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
-- clear_lineup_order, against the week the order is actually for
-- ---------------------------------------------------------------------------

drop function if exists public.clear_lineup_order(uuid, uuid, boolean);

create or replace function public.clear_lineup_order(
  p_user_id uuid,
  p_order_id uuid,
  p_today date,
  p_opened boolean
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  order_row public.lineup_orders;
  removed integer;
begin
  select * into order_row
  from public.lineup_orders
  where id = p_order_id and user_id = p_user_id;

  -- Somebody else's order, or one that never existed. Both are "there is
  -- nothing here of yours to remove", and telling them apart would say
  -- whether an id belongs to somebody.
  if order_row.id is null then
    return false;
  end if;

  /*
    The week comes off the order rather than from the caller. This is the whole
    fix: the caller used to name the week, and named the wrong one every time.
  */
  if public.lineup_locked(order_row.monday, p_today, p_opened) then
    raise exception 'the lineup for this week is locked';
  end if;

  delete from public.lineup_orders
  where id = p_order_id and user_id = p_user_id and ran_at is null;

  get diagnostics removed = row_count;
  return removed > 0;
end;
$$;

revoke all on function public.queue_lineup_order(uuid, date, text, numeric, date, boolean, integer)
  from public, anon, authenticated;
revoke all on function public.clear_lineup_order(uuid, uuid, date, boolean)
  from public, anon, authenticated;

grant execute on function public.queue_lineup_order(uuid, date, text, numeric, date, boolean, integer) to service_role;
grant execute on function public.clear_lineup_order(uuid, uuid, date, boolean) to service_role;
