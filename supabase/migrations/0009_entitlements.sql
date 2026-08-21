-- Upside Arena, phase 8: paying for things, and what that buys.
--
-- Section 9 locks the model, and one line of it governs everything here:
-- money never touches competitive scoring, odds, or trading capability. It
-- buys cosmetics and convenience, and nothing else. Nothing in this file can
-- change a return, a rank, a starting balance or what a player may trade,
-- because none of those tables are reachable from it.
--
-- Two more rules shape the schema:
--
-- Everything bought is direct. There is no bundle whose contents are decided
-- by chance, because a randomised paid box is banned outright in some
-- countries and is the most criticised pattern in consumer software.
--
-- Entitlements are keyed by person and product, never by a Stripe
-- subscription id. Apple and Google require their own purchase systems inside
-- a native app, so the day that ships, adding a provider has to be a new row
-- source rather than a rebuild.

-- ---------------------------------------------------------------------------
-- entitlements
-- ---------------------------------------------------------------------------

create table public.entitlements (
  user_id uuid not null references auth.users (id) on delete cascade,

  -- What they have. 'plus' is the subscription; anything else is a cosmetic.
  product text not null,

  -- Who says so. Deliberately not a Stripe column: the day an app store is
  -- involved, this becomes another value rather than another schema.
  source text not null check (source in ('stripe', 'apple', 'google', 'gift')),

  status text not null default 'active'
    check (status in ('active', 'past_due', 'cancelled', 'expired')),

  /*
    The provider's own reference, for support and reconciliation only. Nothing
    reads entitlements through it, so a provider that vanishes takes nothing
    with it.
  */
  external_ref text,

  granted_at timestamptz not null default now(),

  -- When a subscription stops being paid for. Null for anything permanent,
  -- which is everything bought outright.
  expires_at timestamptz,

  updated_at timestamptz not null default now(),

  primary key (user_id, product)
);

comment on table public.entitlements is
  'What somebody is entitled to, by person and product. Never keyed by a payment provider.';

create index entitlements_expiry_idx on public.entitlements (expires_at)
  where expires_at is not null;

create trigger entitlements_touch_updated_at
  before update on public.entitlements
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Arena Coins
-- ---------------------------------------------------------------------------
-- A balance nobody can write directly, and a ledger explaining every movement
-- in it. The ledger is the record; the balance is a running total kept in the
-- same transaction so a page never has to add up a lifetime of rows.

create table public.coin_balances (
  user_id uuid primary key references auth.users (id) on delete cascade,
  balance integer not null default 0,
  updated_at timestamptz not null default now(),

  constraint coin_balance_not_negative check (balance >= 0)
);

create table public.coin_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,

  -- Positive for bought or granted, negative for spent.
  delta integer not null,
  balance_after integer not null,

  reason text not null check (
    reason in ('purchase', 'spend', 'gift', 'refund')
  ),
  detail text,

  /*
    What makes a movement unique. A payment provider will deliver the same
    completed checkout more than once, and a retry must never mint a second
    pile of coins.
  */
  idempotency_key text not null unique,

  created_at timestamptz not null default now(),

  constraint coin_ledger_delta_not_zero check (delta <> 0)
);

create index coin_ledger_user_idx on public.coin_ledger (user_id, created_at desc);

comment on table public.coin_ledger is
  'Every coin movement, with the key that stops a redelivered payment being credited twice.';

-- ---------------------------------------------------------------------------
-- The provider's own identifiers
-- ---------------------------------------------------------------------------

create table public.billing_customers (
  user_id uuid primary key references auth.users (id) on delete cascade,
  provider text not null default 'stripe',
  customer_id text not null unique,
  created_at timestamptz not null default now()
);

-- Every webhook already handled. A provider retries until it is acknowledged,
-- so without this a retry replays whatever the event did.
create table public.billing_events (
  id text primary key,
  provider text not null default 'stripe',
  kind text not null,
  received_at timestamptz not null default now()
);

comment on table public.billing_events is
  'Webhooks already handled. A provider retries until acknowledged; this is what makes a retry harmless.';

-- ---------------------------------------------------------------------------
-- Cosmetics that can be bought
-- ---------------------------------------------------------------------------
-- The catalogue already holds titles earned by playing. These columns add the
-- ones bought with coins, and the ones that come with the subscription.
--
-- A price is on the item itself. There is no bundle whose contents are
-- decided by chance, and there is no item whose price changes by who is
-- looking at it.

alter table public.rewards
  add column coin_price integer,
  add column plus_only boolean not null default false;

alter table public.rewards
  drop constraint if exists rewards_kind_check;

alter table public.rewards
  add constraint rewards_kind_check check (kind in ('title'));

alter table public.rewards
  add constraint rewards_price_positive check (coin_price is null or coin_price > 0);

comment on column public.rewards.coin_price is
  'What it costs in coins, or null when it can only be earned. Never randomised, never variable.';

insert into public.rewards (id, kind, name, description, streak_required, sort_order, coin_price, plus_only) values
  ('title.the_quiet_one', 'title', 'The quiet one',
   'Bought, not earned. Everyone knows.', null, 100, 250, false),
  ('title.long_game', 'title', 'The long game',
   'Bought, not earned. Says nothing about your results.', null, 110, 250, false),
  ('title.house_style', 'title', 'House style',
   'For Arena Plus members.', null, 120, null, true),
  ('title.patron', 'title', 'Patron',
   'For Arena Plus members.', null, 130, null, true);

-- ---------------------------------------------------------------------------
-- The Upside Lab handoff
-- ---------------------------------------------------------------------------
-- Section 9 calls this the actual business case for Arena existing: an
-- explicit, well-timed moment pointing a consistently good player at the
-- real-money product.
--
-- The token is what lets Lab recognise where somebody came from without Arena
-- handing over an email address in a URL. It is opaque, per player, and means
-- nothing to anybody who does not hold both halves.

create table public.lab_handoffs (
  user_id uuid primary key references auth.users (id) on delete cascade,
  token text not null unique,

  -- How many times the moment has been offered, so it can be offered rarely
  -- and then stopped. A pitch that reappears every week is an advert.
  shown_count integer not null default 0,
  last_shown_at timestamptz,

  dismissed_at timestamptz,
  clicked_at timestamptz,

  created_at timestamptz not null default now()
);

comment on table public.lab_handoffs is
  'Where a player was pointed at Upside Lab, and whether they went. No email ever leaves in a URL.';

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.entitlements enable row level security;
alter table public.coin_balances enable row level security;
alter table public.coin_ledger enable row level security;
alter table public.billing_customers enable row level security;
alter table public.billing_events enable row level security;
alter table public.lab_handoffs enable row level security;

create policy "a player reads their own entitlements"
  on public.entitlements for select
  to authenticated
  using (auth.uid() = user_id);

create policy "a player reads their own coin balance"
  on public.coin_balances for select
  to authenticated
  using (auth.uid() = user_id);

create policy "a player reads their own coin history"
  on public.coin_ledger for select
  to authenticated
  using (auth.uid() = user_id);

create policy "a player reads their own handoff record"
  on public.lab_handoffs for select
  to authenticated
  using (auth.uid() = user_id);

/*
  No policy at all on billing_customers or billing_events, for anybody. A
  player has no reason to read a provider's customer id, and every reason for
  nobody else to.

  And no write policy on any of the six. An entitlement somebody can grant
  themselves is not an entitlement, and a balance somebody can set is not a
  balance.
*/

-- ---------------------------------------------------------------------------
-- grant_entitlement
-- ---------------------------------------------------------------------------

create or replace function public.grant_entitlement(
  p_user_id uuid,
  p_product text,
  p_source text,
  p_status text,
  p_external_ref text default null,
  p_expires_at timestamptz default null
)
returns public.entitlements
language plpgsql
security definer
set search_path = public
as $$
declare
  granted public.entitlements;
begin
  insert into public.entitlements
    (user_id, product, source, status, external_ref, expires_at)
  values
    (p_user_id, p_product, p_source, coalesce(p_status, 'active'), p_external_ref, p_expires_at)
  on conflict (user_id, product) do update
  set source = excluded.source,
      status = excluded.status,
      external_ref = coalesce(excluded.external_ref, public.entitlements.external_ref),
      expires_at = excluded.expires_at
  returning * into granted;

  return granted;
end;
$$;

-- ---------------------------------------------------------------------------
-- has_entitlement
-- ---------------------------------------------------------------------------
-- Active means active now. A subscription that has been cancelled but is paid
-- up until the end of the month is still active, because they paid for it.

create or replace function public.has_entitlement(
  p_user_id uuid,
  p_product text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.entitlements
    where user_id = p_user_id
      and product = p_product
      and status in ('active', 'cancelled')
      and (expires_at is null or expires_at > now())
  )
$$;

-- ---------------------------------------------------------------------------
-- Coins
-- ---------------------------------------------------------------------------

create or replace function public.add_coins(
  p_user_id uuid,
  p_amount integer,
  p_reason text,
  p_idempotency_key text,
  p_detail text default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  current_balance integer;
begin
  if p_amount <= 0 then
    raise exception 'coins added must be positive';
  end if;

  -- Already credited. A payment provider redelivering a completed checkout
  -- must never mint a second pile of coins.
  if exists (select 1 from public.coin_ledger where idempotency_key = p_idempotency_key) then
    return (select balance from public.coin_balances where user_id = p_user_id);
  end if;

  insert into public.coin_balances (user_id) values (p_user_id)
  on conflict (user_id) do nothing;

  update public.coin_balances
  set balance = balance + p_amount
  where user_id = p_user_id
  returning balance into current_balance;

  insert into public.coin_ledger
    (user_id, delta, balance_after, reason, detail, idempotency_key)
  values
    (p_user_id, p_amount, current_balance, p_reason, p_detail, p_idempotency_key);

  return current_balance;
end;
$$;

/*
  Spending on one specific thing.

  The whole purchase happens here: the balance check, the deduction, the
  ledger line and the item itself, in one transaction. Split across two calls
  it would be possible to be charged and get nothing.
*/
create or replace function public.buy_reward(
  p_user_id uuid,
  p_reward_id text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  price integer;
  is_plus_only boolean;
  current_balance integer;
begin
  select coin_price, plus_only into price, is_plus_only
  from public.rewards where id = p_reward_id;

  if price is null then
    -- Either it does not exist, or it is earned rather than bought. Both are
    -- refusals, and neither should say which.
    raise exception 'that is not for sale';
  end if;

  if is_plus_only and not public.has_entitlement(p_user_id, 'plus') then
    raise exception 'that is not for sale';
  end if;

  if exists (
    select 1 from public.user_rewards
    where user_id = p_user_id and reward_id = p_reward_id
  ) then
    raise exception 'you already own that';
  end if;

  -- Locked, so two taps on a slow connection cannot both pass the check.
  select balance into current_balance
  from public.coin_balances where user_id = p_user_id for update;

  if current_balance is null or current_balance < price then
    raise exception 'not enough coins';
  end if;

  update public.coin_balances
  set balance = balance - price
  where user_id = p_user_id
  returning balance into current_balance;

  insert into public.coin_ledger
    (user_id, delta, balance_after, reason, detail, idempotency_key)
  values
    (p_user_id, -price, current_balance, 'spend', p_reward_id,
     'spend:' || p_user_id::text || ':' || p_reward_id);

  insert into public.user_rewards (user_id, reward_id)
  values (p_user_id, p_reward_id);

  return current_balance;
end;
$$;

-- ---------------------------------------------------------------------------
-- Billing bookkeeping
-- ---------------------------------------------------------------------------

create or replace function public.link_billing_customer(
  p_user_id uuid,
  p_customer_id text,
  p_provider text default 'stripe'
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.billing_customers (user_id, customer_id, provider)
  values (p_user_id, p_customer_id, p_provider)
  on conflict (user_id) do update set customer_id = excluded.customer_id
$$;

/*
  Claims one webhook, once.

  Returns false when this event has already been handled, which is how a
  provider's retries stop being replays. Called before anything is acted on,
  so the acting is what is protected rather than the acknowledging.
*/
create or replace function public.claim_billing_event(
  p_id text,
  p_kind text,
  p_provider text default 'stripe'
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted integer;
begin
  insert into public.billing_events (id, kind, provider)
  values (p_id, p_kind, p_provider)
  on conflict (id) do nothing;

  get diagnostics inserted = row_count;
  return inserted > 0;
end;
$$;

-- ---------------------------------------------------------------------------
-- The handoff
-- ---------------------------------------------------------------------------

create or replace function public.record_handoff_shown(p_user_id uuid)
returns public.lab_handoffs
language plpgsql
security definer
set search_path = public
as $$
declare
  handoff public.lab_handoffs;
begin
  insert into public.lab_handoffs (user_id, token)
  values (p_user_id, replace(gen_random_uuid()::text, '-', ''))
  on conflict (user_id) do nothing;

  update public.lab_handoffs
  set shown_count = shown_count + 1,
      last_shown_at = now()
  where user_id = p_user_id
  returning * into handoff;

  return handoff;
end;
$$;

create or replace function public.record_handoff_outcome(
  p_user_id uuid,
  p_outcome text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_outcome = 'clicked' then
    update public.lab_handoffs set clicked_at = now() where user_id = p_user_id;
  elsif p_outcome = 'dismissed' then
    update public.lab_handoffs set dismissed_at = now() where user_id = p_user_id;
  else
    raise exception 'unknown outcome';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Only the service role writes any of this
-- ---------------------------------------------------------------------------

revoke all on function public.grant_entitlement(uuid, text, text, text, text, timestamptz) from public, anon, authenticated;
revoke all on function public.has_entitlement(uuid, text) from public, anon, authenticated;
revoke all on function public.add_coins(uuid, integer, text, text, text) from public, anon, authenticated;
revoke all on function public.buy_reward(uuid, text) from public, anon, authenticated;
revoke all on function public.link_billing_customer(uuid, text, text) from public, anon, authenticated;
revoke all on function public.claim_billing_event(text, text, text) from public, anon, authenticated;
revoke all on function public.record_handoff_shown(uuid) from public, anon, authenticated;
revoke all on function public.record_handoff_outcome(uuid, text) from public, anon, authenticated;

grant execute on function public.grant_entitlement(uuid, text, text, text, text, timestamptz) to service_role;
grant execute on function public.has_entitlement(uuid, text) to service_role;
grant execute on function public.add_coins(uuid, integer, text, text, text) to service_role;
grant execute on function public.buy_reward(uuid, text) to service_role;
grant execute on function public.link_billing_customer(uuid, text, text) to service_role;
grant execute on function public.claim_billing_event(text, text, text) to service_role;
grant execute on function public.record_handoff_shown(uuid) to service_role;
grant execute on function public.record_handoff_outcome(uuid, text) to service_role;

-- ---------------------------------------------------------------------------
-- record_activity, now with a weekly freeze count
-- ---------------------------------------------------------------------------
-- Replaces the phase 4 version. Identical, except that how many freezes the
-- weekly grant lifts somebody to is passed in rather than fixed at one.
--
-- Section 9 puts extra freezes behind the subscription, and this is the only
-- change anywhere that makes that true. It is a convenience and not an
-- advantage: a freeze covers a day somebody did not open the app, and a
-- streak has never touched a standing or a lifetime figure.
--
-- The app decides the number, because the app is what knows about
-- entitlements. Postgres is not the place for a billing rule any more than it
-- is for a market calendar.

create or replace function public.record_activity(
  p_user_id uuid,
  p_today date,
  p_missed_days integer,
  p_week_monday date,
  p_weekly_freezes integer default 1
)
returns public.streaks
language plpgsql
security definer
set search_path = public
as $$
declare
  streak public.streaks;
  reward record;
  grant_to integer := greatest(coalesce(p_weekly_freezes, 1), 1);
begin
  insert into public.streaks (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  select * into streak from public.streaks where user_id = p_user_id for update;

  -- The weekly grant. It lifts the count rather than setting it, so a freeze
  -- bought or carried over is not wiped out every Monday.
  if streak.freeze_granted_week is null or streak.freeze_granted_week < p_week_monday then
    streak.freezes_available := greatest(streak.freezes_available, grant_to);
    streak.freeze_granted_week := p_week_monday;
  end if;

  if streak.last_active_date is null then
    streak.current_streak := 1;
  elsif streak.last_active_date = p_today then
    null;
  elsif streak.last_active_date > p_today then
    null;
  elsif p_missed_days <= 0 then
    streak.current_streak := streak.current_streak + 1;
  elsif streak.freezes_available >= p_missed_days then
    streak.freezes_available := streak.freezes_available - p_missed_days;
    streak.freezes_used := streak.freezes_used + p_missed_days;
    streak.current_streak := streak.current_streak + 1;
  else
    streak.current_streak := 1;
  end if;

  if streak.last_active_date is null or streak.last_active_date < p_today then
    streak.last_active_date := p_today;
  end if;

  streak.longest_streak := greatest(streak.longest_streak, streak.current_streak);

  update public.streaks
  set current_streak = streak.current_streak,
      longest_streak = streak.longest_streak,
      last_active_date = streak.last_active_date,
      freezes_available = streak.freezes_available,
      freezes_used = streak.freezes_used,
      freeze_granted_week = streak.freeze_granted_week
  where user_id = p_user_id
  returning * into streak;

  update public.profiles
  set longest_streak = greatest(longest_streak, streak.longest_streak)
  where id = p_user_id;

  for reward in
    select id from public.rewards
    where streak_required is not null
      and streak_required <= streak.current_streak
  loop
    insert into public.user_rewards (user_id, reward_id)
    values (p_user_id, reward.id)
    on conflict (user_id, reward_id) do nothing;
  end loop;

  return streak;
end;
$$;

revoke all on function public.record_activity(uuid, date, integer, date, integer) from public, anon, authenticated;
grant execute on function public.record_activity(uuid, date, integer, date, integer) to service_role;

/*
  The four argument version is dropped rather than left alongside. Two
  overloads that differ only by a defaulted argument make every call
  ambiguous, and Postgres refuses them at call time rather than at creation.
*/
drop function if exists public.record_activity(uuid, date, integer, date);
