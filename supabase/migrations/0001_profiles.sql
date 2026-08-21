-- Upside Arena, phase 1: accounts, profiles, age gate, terms acceptance.
--
-- Row Level Security is on for every table here and stays on for every
-- multi-tenant table added later. Isolation belongs in the database, not
-- only in application code.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
-- One row per auth user. Created automatically by the trigger below so a
-- profile can never be missing for a signed-in account.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,

  -- Public identity.
  handle text unique,
  display_name text,
  avatar_url text,

  -- Age gate. 16+, matching Upside Lab exactly. Recorded, not just checked
  -- in the browser, so the confirmation is auditable.
  age_confirmed_at timestamptz,

  -- Persistent skill rating. Unused until public pods arrive, stored from
  -- day one because it is cheap now and expensive to retrofit.
  rating integer not null default 1000,

  -- Lifetime stats. Never mixed into current-week standings.
  weeks_played integer not null default 0,
  best_week_return numeric(10, 4),
  career_alpha_avg numeric(10, 4),
  longest_streak integer not null default 0,

  onboarded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- A handle is lowercase, 3 to 20 characters, letters, numbers, underscore.
  constraint profiles_handle_format
    check (handle is null or handle ~ '^[a-z0-9_]{3,20}$'),
  constraint profiles_display_name_length
    check (display_name is null or char_length(display_name) between 1 and 40),
  constraint profiles_rating_range
    check (rating between 0 and 5000)
);

comment on column public.profiles.rating is
  'Persistent skill rating for future matchmade pods. Not shown in phase 1.';

create index profiles_handle_idx on public.profiles (handle);
create index profiles_rating_idx on public.profiles (rating desc);

-- ---------------------------------------------------------------------------
-- terms_acceptances
-- ---------------------------------------------------------------------------
-- Append-only record of which document version an account agreed to, so a
-- later revision can be re-prompted without losing the earlier consent.

create table public.terms_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  document text not null check (document in ('terms', 'privacy')),
  version text not null,
  accepted_at timestamptz not null default now(),
  unique (user_id, document, version)
);

create index terms_acceptances_user_idx on public.terms_acceptances (user_id);

-- ---------------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------------

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- profile creation on signup
-- ---------------------------------------------------------------------------
-- Runs as definer because auth.users triggers execute outside the caller's
-- RLS context. search_path is pinned so the function cannot be hijacked by a
-- shadowing schema.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    nullif(
      coalesce(
        new.raw_user_meta_data ->> 'full_name',
        new.raw_user_meta_data ->> 'name',
        split_part(coalesce(new.email, ''), '@', 1)
      ),
      ''
    ),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.terms_acceptances enable row level security;

-- A player reads their own profile and no one else's. Nothing in phase 1
-- shows another player. When leagues arrive, add a policy scoped to shared
-- league membership rather than widening this one to every signed-in account.
create policy "a user reads their own profile"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id);

create policy "a user updates only their own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "a user inserts only their own profile"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

create policy "a user reads their own acceptances"
  on public.terms_acceptances for select
  to authenticated
  using (auth.uid() = user_id);

create policy "a user records their own acceptances"
  on public.terms_acceptances for insert
  to authenticated
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Guard the columns a player should not be able to set for themselves
-- ---------------------------------------------------------------------------
-- RLS decides which rows are writable, not which columns. Rating and lifetime
-- stats are awarded by the game, so a direct client update must not move them.

create or replace function public.protect_profile_fields()
returns trigger
language plpgsql
as $$
begin
  -- PostgREST switches roles per request, so the current role is what marks a
  -- trusted caller. The game awards these fields; a player cannot set them.
  if current_user in ('service_role', 'supabase_admin', 'postgres') then
    return new;
  end if;

  new.rating          = old.rating;
  new.weeks_played    = old.weeks_played;
  new.best_week_return = old.best_week_return;
  new.career_alpha_avg = old.career_alpha_avg;
  new.longest_streak  = old.longest_streak;
  new.created_at      = old.created_at;

  -- The age gate is a one-way latch. It can be set once, never cleared.
  if old.age_confirmed_at is not null then
    new.age_confirmed_at = old.age_confirmed_at;
  end if;

  return new;
end;
$$;

create trigger profiles_protect_fields
  before update on public.profiles
  for each row execute function public.protect_profile_fields();

-- ---------------------------------------------------------------------------
-- account deletion
-- ---------------------------------------------------------------------------
-- Privacy compliance needs a real delete path, not a support ticket. Erasing
-- the auth user cascades to every table that references it.

create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not signed in';
  end if;

  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.delete_own_account() from public;
grant execute on function public.delete_own_account() to authenticated;
