-- Upside Arena, phase 5: notifications.
--
-- Every notification this table can hold describes something that actually
-- happened: a named person passed you, your week was scored, your streak is
-- still going and today is not counted yet. There is no kind for "come back",
-- because there is nothing true to say in one.
--
-- Section 3 of the plan is specific about why. A nudge that pairs a real
-- deadline with a small, concrete action gets acted on. A vague, dread-toned
-- one gets muted, and a muted channel is worth nothing at all.

-- ---------------------------------------------------------------------------
-- push_subscriptions
-- ---------------------------------------------------------------------------
-- One row per browser that has agreed to receive push. A person can have
-- several: a phone, a laptop, a home screen install.

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,

  -- The push service's address for this browser. Unique across everyone: the
  -- same browser cannot belong to two accounts at once.
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,

  user_agent text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,

  -- A push service tells us when a subscription is dead. After a few
  -- failures it is removed rather than retried for ever.
  failures integer not null default 0
);

create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

-- ---------------------------------------------------------------------------
-- notification_settings
-- ---------------------------------------------------------------------------
-- Off is always one tap away, and each kind can be turned off on its own. A
-- channel someone cannot control is a channel they mute entirely.

create table public.notification_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,

  push_enabled boolean not null default true,
  email_enabled boolean not null default true,

  -- The kinds, each separately refusable.
  rival_alerts boolean not null default true,
  week_result boolean not null default true,
  streak_reminder boolean not null default true,

  /*
    Where the player is, so nothing arrives in the middle of their night.
    Defaults to the market's timezone and is replaced with the browser's the
    first time they turn notifications on.
  */
  timezone text not null default 'America/New_York',

  updated_at timestamptz not null default now()
);

create trigger notification_settings_touch_updated_at
  before update on public.notification_settings
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- notifications
-- ---------------------------------------------------------------------------
-- What was sent. Doubles as the record that stops the same thing being sent
-- twice and as the count behind the daily cap.

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,

  kind text not null check (
    kind in ('rival_passed', 'week_result', 'streak_reminder')
  ),

  /*
    What makes this notification unique. Being passed by the same person in
    the same league on the same day is one event however many times the job
    runs, so the job can run every hour without ever repeating itself.
  */
  dedupe_key text not null,

  title text not null,
  body text not null,
  url text,

  channel text not null check (channel in ('push', 'email', 'none')),
  created_at timestamptz not null default now(),

  unique (user_id, dedupe_key)
);

create index notifications_user_recent_idx
  on public.notifications (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Where each player stood last time we looked
-- ---------------------------------------------------------------------------
-- Being passed is a change, not a state, so it can only be noticed by
-- comparing against the last time anyone looked.

alter table public.league_members
  add column last_rank integer,
  add column last_rank_at timestamptz;

comment on column public.league_members.last_rank is
  'Rank at the previous notification pass. Null until the first one.';

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.push_subscriptions enable row level security;
alter table public.notification_settings enable row level security;
alter table public.notifications enable row level security;

create policy "a player reads their own push subscriptions"
  on public.push_subscriptions for select
  to authenticated
  using (auth.uid() = user_id);

create policy "a player reads their own notification settings"
  on public.notification_settings for select
  to authenticated
  using (auth.uid() = user_id);

create policy "a player reads their own notifications"
  on public.notifications for select
  to authenticated
  using (auth.uid() = user_id);

-- No write policy for a player on any of them. Settings change through the
-- function below, which is the only path that exists.

-- ---------------------------------------------------------------------------
-- save_notification_settings
-- ---------------------------------------------------------------------------

create or replace function public.save_notification_settings(
  p_user_id uuid,
  p_push_enabled boolean,
  p_email_enabled boolean,
  p_rival_alerts boolean,
  p_week_result boolean,
  p_streak_reminder boolean,
  p_timezone text default null
)
returns public.notification_settings
language plpgsql
security definer
set search_path = public
as $$
declare
  settings public.notification_settings;
begin
  insert into public.notification_settings (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  update public.notification_settings
  set push_enabled = coalesce(p_push_enabled, push_enabled),
      email_enabled = coalesce(p_email_enabled, email_enabled),
      rival_alerts = coalesce(p_rival_alerts, rival_alerts),
      week_result = coalesce(p_week_result, week_result),
      streak_reminder = coalesce(p_streak_reminder, streak_reminder),
      timezone = coalesce(nullif(btrim(coalesce(p_timezone, '')), ''), timezone)
  where user_id = p_user_id
  returning * into settings;

  return settings;
end;
$$;

-- ---------------------------------------------------------------------------
-- save_push_subscription
-- ---------------------------------------------------------------------------

create or replace function public.save_push_subscription(
  p_user_id uuid,
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_user_agent text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  /*
    The same browser signing in as somebody else takes the subscription with
    it. Without this the previous account would keep getting push on a device
    that is no longer theirs.
  */
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
  values (p_user_id, p_endpoint, p_p256dh, p_auth, p_user_agent)
  on conflict (endpoint) do update
  set user_id = excluded.user_id,
      p256dh = excluded.p256dh,
      auth = excluded.auth,
      user_agent = excluded.user_agent,
      failures = 0;

  insert into public.notification_settings (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;
end;
$$;

create or replace function public.delete_push_subscription(p_endpoint text)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.push_subscriptions where endpoint = p_endpoint
$$;

-- ---------------------------------------------------------------------------
-- record_notification
-- ---------------------------------------------------------------------------
-- Claims the right to send one thing, once. Returns false when this exact
-- event has already been sent, or when the player has had enough today.

create or replace function public.record_notification(
  p_user_id uuid,
  p_kind text,
  p_dedupe_key text,
  p_title text,
  p_body text,
  p_url text,
  p_channel text,
  p_daily_cap integer default 3
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  sent_today integer;
  inserted integer;
begin
  select count(*) into sent_today
  from public.notifications
  where user_id = p_user_id
    and channel <> 'none'
    and created_at > now() - interval '24 hours';

  if sent_today >= p_daily_cap then
    return false;
  end if;

  insert into public.notifications
    (user_id, kind, dedupe_key, title, body, url, channel)
  values
    (p_user_id, p_kind, p_dedupe_key, p_title, p_body, p_url, p_channel)
  on conflict (user_id, dedupe_key) do nothing;

  get diagnostics inserted = row_count;
  return inserted > 0;
end;
$$;

-- ---------------------------------------------------------------------------
-- update_member_ranks
-- ---------------------------------------------------------------------------
-- Records where everyone stands now, so the next pass can tell what changed.

create or replace function public.update_member_ranks(
  p_league_id uuid,
  p_ranks jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  entry record;
begin
  for entry in
    select key as user_id, value::text::integer as rank
    from jsonb_each(p_ranks)
  loop
    update public.league_members
    set last_rank = entry.rank,
        last_rank_at = now()
    where league_id = p_league_id and user_id = entry.user_id::uuid;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Only the service role writes any of this
-- ---------------------------------------------------------------------------

revoke all on function public.save_notification_settings(uuid, boolean, boolean, boolean, boolean, boolean, text) from public, anon, authenticated;
revoke all on function public.save_push_subscription(uuid, text, text, text, text) from public, anon, authenticated;
revoke all on function public.delete_push_subscription(text) from public, anon, authenticated;
revoke all on function public.record_notification(uuid, text, text, text, text, text, text, integer) from public, anon, authenticated;
revoke all on function public.update_member_ranks(uuid, jsonb) from public, anon, authenticated;

grant execute on function public.save_notification_settings(uuid, boolean, boolean, boolean, boolean, boolean, text) to service_role;
grant execute on function public.save_push_subscription(uuid, text, text, text, text) to service_role;
grant execute on function public.delete_push_subscription(text) to service_role;
grant execute on function public.record_notification(uuid, text, text, text, text, text, text, integer) to service_role;
grant execute on function public.update_member_ranks(uuid, jsonb) to service_role;
