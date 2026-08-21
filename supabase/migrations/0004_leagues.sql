-- Upside Arena, phase 3: private leagues.
--
-- A league is the unit the game is actually played in. It needs no population
-- density to work, which is why it launches before matchmade pods: two friends
-- are enough.

-- ---------------------------------------------------------------------------
-- leagues
-- ---------------------------------------------------------------------------

create table public.leagues (
  id uuid primary key default gen_random_uuid(),

  -- Naming it is the point. A league someone named and gave an icon to gets
  -- checked the way a group chat they started does.
  name text not null,
  icon text,

  owner_id uuid not null references auth.users (id) on delete cascade,

  -- Server generated, never chosen. A code someone picks is a code someone
  -- else can guess, and guessing one is how you get into a private league.
  invite_code text not null unique,

  -- How many people may join. Recorded per league so raising the limit later
  -- cannot retroactively change what an existing league allowed.
  max_members integer not null default 20,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint leagues_name_length check (char_length(btrim(name)) between 1 and 40),
  constraint leagues_icon_length check (icon is null or char_length(icon) <= 8),
  constraint leagues_invite_code_shape check (invite_code ~ '^[A-Z0-9]{8}$'),
  constraint leagues_max_members_range check (max_members between 2 and 200)
);

create index leagues_owner_idx on public.leagues (owner_id);
create index leagues_invite_code_idx on public.leagues (invite_code);

create trigger leagues_touch_updated_at
  before update on public.leagues
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- league_members
-- ---------------------------------------------------------------------------

create table public.league_members (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),

  unique (league_id, user_id)
);

create index league_members_league_idx on public.league_members (league_id);
create index league_members_user_idx on public.league_members (user_id);

-- ---------------------------------------------------------------------------
-- Membership check
-- ---------------------------------------------------------------------------
-- A policy on league_members that queries league_members recurses for ever.
-- This runs as definer, so it sees the table without triggering the policy
-- that calls it.

create or replace function public.is_league_member(p_league_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.league_members
    where league_id = p_league_id and user_id = p_user_id
  )
$$;

grant execute on function public.is_league_member(uuid, uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
-- Read the leagues you are in. Write none of it.

alter table public.leagues enable row level security;
alter table public.league_members enable row level security;

create policy "a player reads leagues they are in"
  on public.leagues for select
  to authenticated
  using (public.is_league_member(id, auth.uid()));

create policy "a player reads the roster of leagues they are in"
  on public.league_members for select
  to authenticated
  using (public.is_league_member(league_id, auth.uid()));

/*
  Deliberately no insert, update or delete policy for a player.

  Creating, joining and leaving all go through the functions below. Joining in
  particular has to check a code, a size limit and whether the league is
  already full, and a client that could insert its own membership row would
  skip all three.

  Profile rows are still readable only by their owner. Standings are built on
  the server, which reads them with the service role and returns just the name,
  tag and picture, so a league roster never becomes a way to read another
  player's rating or lifetime record.
*/

-- ---------------------------------------------------------------------------
-- Invite codes
-- ---------------------------------------------------------------------------

/*
  Eight characters from an alphabet with no I, O, 0 or 1 in it, so a code read
  aloud or typed from a screenshot lands on the league it was meant to.
*/
create or replace function public.generate_invite_code()
returns text
language plpgsql
volatile
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text;
  i integer;
begin
  loop
    code := '';
    for i in 1..8 loop
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;

    exit when not exists (select 1 from public.leagues where invite_code = code);
  end loop;

  return code;
end;
$$;

-- ---------------------------------------------------------------------------
-- create_league
-- ---------------------------------------------------------------------------

create or replace function public.create_league(
  p_user_id uuid,
  p_name text,
  p_icon text default null,
  p_max_leagues integer default 3,
  p_max_members integer default 20
)
returns public.leagues
language plpgsql
security definer
set search_path = public
as $$
declare
  league public.leagues;
  owned integer;
begin
  if btrim(coalesce(p_name, '')) = '' then
    raise exception 'a league needs a name';
  end if;

  select count(*) into owned
  from public.league_members
  where user_id = p_user_id and role = 'owner';

  if owned >= p_max_leagues then
    raise exception 'league limit reached';
  end if;

  insert into public.leagues (name, icon, owner_id, invite_code, max_members)
  values (
    btrim(p_name),
    nullif(btrim(coalesce(p_icon, '')), ''),
    p_user_id,
    public.generate_invite_code(),
    p_max_members
  )
  returning * into league;

  insert into public.league_members (league_id, user_id, role)
  values (league.id, p_user_id, 'owner');

  return league;
end;
$$;

-- ---------------------------------------------------------------------------
-- join_league
-- ---------------------------------------------------------------------------

create or replace function public.join_league(
  p_user_id uuid,
  p_invite_code text,
  p_max_leagues integer default 10
)
returns public.leagues
language plpgsql
security definer
set search_path = public
as $$
declare
  league public.leagues;
  members integer;
  joined integer;
begin
  select * into league
  from public.leagues
  where invite_code = upper(btrim(coalesce(p_invite_code, '')))
  for update;

  if league.id is null then
    raise exception 'no league with that code';
  end if;

  -- Already in it. Returning the league rather than raising means following an
  -- invite twice just takes you to the league, which is what you wanted.
  if public.is_league_member(league.id, p_user_id) then
    return league;
  end if;

  select count(*) into joined
  from public.league_members
  where user_id = p_user_id;

  if joined >= p_max_leagues then
    raise exception 'you are in too many leagues';
  end if;

  select count(*) into members
  from public.league_members
  where league_id = league.id;

  if members >= league.max_members then
    raise exception 'that league is full';
  end if;

  insert into public.league_members (league_id, user_id, role)
  values (league.id, p_user_id, 'member');

  return league;
end;
$$;

-- ---------------------------------------------------------------------------
-- leave_league
-- ---------------------------------------------------------------------------

/*
  Leaving is always allowed. The owner leaving hands the league to whoever
  joined earliest rather than deleting it, because a league is a shared thing
  and the person who made it should not be able to take everyone else's
  standings with them. An owner alone in their own league deletes it.
*/
create or replace function public.leave_league(
  p_user_id uuid,
  p_league_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  league public.leagues;
  remaining uuid;
begin
  select * into league from public.leagues where id = p_league_id for update;
  if league.id is null then
    raise exception 'unknown league';
  end if;

  if not public.is_league_member(p_league_id, p_user_id) then
    raise exception 'you are not in that league';
  end if;

  delete from public.league_members
  where league_id = p_league_id and user_id = p_user_id;

  if league.owner_id <> p_user_id then
    return;
  end if;

  select user_id into remaining
  from public.league_members
  where league_id = p_league_id
  order by joined_at asc
  limit 1;

  if remaining is null then
    delete from public.leagues where id = p_league_id;
    return;
  end if;

  update public.leagues set owner_id = remaining where id = p_league_id;
  update public.league_members
  set role = 'owner'
  where league_id = p_league_id and user_id = remaining;
end;
$$;

-- ---------------------------------------------------------------------------
-- rename_league
-- ---------------------------------------------------------------------------

create or replace function public.rename_league(
  p_user_id uuid,
  p_league_id uuid,
  p_name text,
  p_icon text default null
)
returns public.leagues
language plpgsql
security definer
set search_path = public
as $$
declare
  league public.leagues;
begin
  select * into league from public.leagues where id = p_league_id;

  if league.id is null or league.owner_id <> p_user_id then
    raise exception 'only the person who made the league can rename it';
  end if;

  if btrim(coalesce(p_name, '')) = '' then
    raise exception 'a league needs a name';
  end if;

  update public.leagues
  set name = btrim(p_name),
      icon = nullif(btrim(coalesce(p_icon, '')), '')
  where id = p_league_id
  returning * into league;

  return league;
end;
$$;

-- ---------------------------------------------------------------------------
-- Only the service role writes a league
-- ---------------------------------------------------------------------------

revoke all on function public.create_league(uuid, text, text, integer, integer) from public, anon, authenticated;
revoke all on function public.join_league(uuid, text, integer) from public, anon, authenticated;
revoke all on function public.leave_league(uuid, uuid) from public, anon, authenticated;
revoke all on function public.rename_league(uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function public.generate_invite_code() from public, anon, authenticated;

grant execute on function public.create_league(uuid, text, text, integer, integer) to service_role;
grant execute on function public.join_league(uuid, text, integer) to service_role;
grant execute on function public.leave_league(uuid, uuid) to service_role;
grant execute on function public.rename_league(uuid, uuid, text, text) to service_role;
grant execute on function public.generate_invite_code() to service_role;
