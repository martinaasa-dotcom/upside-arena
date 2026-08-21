-- Upside Arena, phase 4: streaks, the freeze, and cosmetic rewards.
--
-- A streak counts trading days, not calendar days. Arena cannot be played at
-- the weekend, so breaking a streak for not opening an app on a day the game
-- does not run would be manufactured anxiety, which section 3 of the plan
-- rules out as firmly as fake urgency. The app works out which days those are
-- and tells this function; Postgres is not the place for a market calendar.

-- ---------------------------------------------------------------------------
-- streaks
-- ---------------------------------------------------------------------------

create table public.streaks (
  user_id uuid primary key references auth.users (id) on delete cascade,

  current_streak integer not null default 0,
  longest_streak integer not null default 0,

  -- The last New York trading date credited to this player.
  last_active_date date,

  -- One free freeze a week. Purchased ones will sit on top of this later, so
  -- the weekly grant lifts the count to one rather than setting it to one.
  freezes_available integer not null default 1,
  freezes_used integer not null default 0,
  freeze_granted_week date,

  updated_at timestamptz not null default now(),

  constraint streaks_counts_not_negative check (
    current_streak >= 0
    and longest_streak >= 0
    and freezes_available >= 0
    and freezes_used >= 0
  )
);

comment on table public.streaks is
  'Showing up, counted in trading days. A broken streak never touches standings or lifetime stats.';

create trigger streaks_touch_updated_at
  before update on public.streaks
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- rewards
-- ---------------------------------------------------------------------------
-- The catalogue. Cosmetic only, always: a title next to your name and nothing
-- else. Nothing here affects scoring, and nothing here can be bought.

create table public.rewards (
  id text primary key,
  kind text not null check (kind in ('title')),
  name text not null,
  description text not null,
  -- Streak length that earns it, when that is how it is earned.
  streak_required integer,
  sort_order integer not null default 0,

  constraint rewards_id_shape check (id ~ '^[a-z0-9_.]{3,40}$')
);

comment on table public.rewards is
  'Cosmetic rewards. Earned through play only, never bought, and never affecting a score.';

insert into public.rewards (id, kind, name, description, streak_required, sort_order) values
  ('title.off_the_mark', 'title', 'Off the mark',
   'Made your first trade.', null, 10),
  ('title.full_week', 'title', 'A full week',
   'Showed up every trading day for a week.', 5, 20),
  ('title.two_weeks', 'title', 'Two weeks running',
   'Ten trading days in a row.', 10, 30),
  ('title.a_month', 'title', 'A month of showing up',
   'Twenty trading days in a row.', 20, 40),
  ('title.two_months', 'title', 'Still here',
   'Forty trading days in a row.', 40, 50);

-- ---------------------------------------------------------------------------
-- user_rewards
-- ---------------------------------------------------------------------------

create table public.user_rewards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  reward_id text not null references public.rewards (id) on delete cascade,
  earned_at timestamptz not null default now(),

  unique (user_id, reward_id)
);

create index user_rewards_user_idx on public.user_rewards (user_id);

-- The title a player has chosen to wear. Null is a perfectly good answer.
alter table public.profiles
  add column equipped_title text references public.rewards (id) on delete set null;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.streaks enable row level security;
alter table public.rewards enable row level security;
alter table public.user_rewards enable row level security;

create policy "a player reads their own streak"
  on public.streaks for select
  to authenticated
  using (auth.uid() = user_id);

-- The catalogue is not secret. Seeing what can be earned is the point of it.
create policy "the catalogue is readable by signed-in players"
  on public.rewards for select
  to authenticated
  using (true);

create policy "a player reads their own rewards"
  on public.user_rewards for select
  to authenticated
  using (auth.uid() = user_id);

-- No write policy for a player on any of the three. A streak someone can set
-- is not a streak, and a reward someone can grant themselves is not a reward.

-- ---------------------------------------------------------------------------
-- A title has to be owned to be worn
-- ---------------------------------------------------------------------------
-- Row level security decides which rows are writable, not which values are
-- allowed in them. Without this, a player could equip a title they never
-- earned by writing straight to their own profile row.

create or replace function public.protect_equipped_title()
returns trigger
language plpgsql
as $$
begin
  if new.equipped_title is distinct from old.equipped_title
     and new.equipped_title is not null
     and not exists (
       select 1 from public.user_rewards
       where user_id = new.id and reward_id = new.equipped_title
     )
  then
    raise exception 'you have not earned that title';
  end if;

  return new;
end;
$$;

create trigger profiles_protect_equipped_title
  before update on public.profiles
  for each row execute function public.protect_equipped_title();

-- ---------------------------------------------------------------------------
-- record_activity
-- ---------------------------------------------------------------------------
-- Credits today to a player's streak, spends freezes to cover days they
-- missed, grants the free weekly freeze, and hands out any milestone reached.
--
-- p_missed_days is how many trading days sit between their last visit and
-- today, worked out by the app, which knows the market calendar.
--
-- Idempotent within a day: opening the app twice on a Tuesday counts once.

create or replace function public.record_activity(
  p_user_id uuid,
  p_today date,
  p_missed_days integer,
  p_week_monday date
)
returns public.streaks
language plpgsql
security definer
set search_path = public
as $$
declare
  streak public.streaks;
  reward record;
begin
  insert into public.streaks (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  select * into streak from public.streaks where user_id = p_user_id for update;

  -- The free weekly freeze. It lifts the count to one rather than setting it,
  -- so a freeze bought later is not wiped out every Monday.
  if streak.freeze_granted_week is null or streak.freeze_granted_week < p_week_monday then
    streak.freezes_available := greatest(streak.freezes_available, 1);
    streak.freeze_granted_week := p_week_monday;
  end if;

  if streak.last_active_date is null then
    streak.current_streak := 1;
  elsif streak.last_active_date = p_today then
    -- Already counted today. Nothing to add, and nothing to spend.
    null;
  elsif streak.last_active_date > p_today then
    -- A clock somewhere is wrong. Leave the streak alone rather than punish
    -- someone for it.
    null;
  elsif p_missed_days <= 0 then
    streak.current_streak := streak.current_streak + 1;
  elsif streak.freezes_available >= p_missed_days then
    -- Covered. The streak survives and the freezes are spent.
    streak.freezes_available := streak.freezes_available - p_missed_days;
    streak.freezes_used := streak.freezes_used + p_missed_days;
    streak.current_streak := streak.current_streak + 1;
  else
    -- Broken. Only the streak resets: standings and lifetime stats are
    -- untouched, so loss aversion stays pointed at the streak itself.
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

  -- Keep the profile's copy true. It is what the profile page shows.
  update public.profiles
  set longest_streak = greatest(longest_streak, streak.longest_streak)
  where id = p_user_id;

  -- Every milestone reached, not just the newest, so a freeze carrying a
  -- streak past two at once still hands over both.
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

-- ---------------------------------------------------------------------------
-- grant_reward
-- ---------------------------------------------------------------------------
-- For rewards that are not about streaks, such as making a first trade.

create or replace function public.grant_reward(
  p_user_id uuid,
  p_reward_id text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  granted integer;
begin
  insert into public.user_rewards (user_id, reward_id)
  values (p_user_id, p_reward_id)
  on conflict (user_id, reward_id) do nothing;

  get diagnostics granted = row_count;
  return granted > 0;
end;
$$;

-- ---------------------------------------------------------------------------
-- equip_title
-- ---------------------------------------------------------------------------

create or replace function public.equip_title(
  p_user_id uuid,
  p_reward_id text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_reward_id is not null and not exists (
    select 1 from public.user_rewards
    where user_id = p_user_id and reward_id = p_reward_id
  ) then
    raise exception 'you have not earned that title';
  end if;

  update public.profiles
  set equipped_title = p_reward_id
  where id = p_user_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Only the service role writes a streak or a reward
-- ---------------------------------------------------------------------------

revoke all on function public.record_activity(uuid, date, integer, date) from public, anon, authenticated;
revoke all on function public.grant_reward(uuid, text) from public, anon, authenticated;
revoke all on function public.equip_title(uuid, text) from public, anon, authenticated;

grant execute on function public.record_activity(uuid, date, integer, date) to service_role;
grant execute on function public.grant_reward(uuid, text) to service_role;
grant execute on function public.equip_title(uuid, text) to service_role;
