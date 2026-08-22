-- Upside Arena, phase 9: public matchmade pods.
--
-- Section 2.2: roughly twenty to thirty people, promotion and relegation every
-- week, up a bronze, silver, gold, diamond ladder, bucketed from the rating
-- phase 1 put on the profile for exactly this.
--
-- The same section is emphatic that this should not go live until there is
-- real concurrent volume, "or pods will feel dead". Nothing here decides that.
-- Placement is only ever done by the app, which holds the switch, so this
-- schema can sit finished and unused until the day it is worth turning on.
--
-- A pod is not a league. A league is somebody's, it persists, it has a name
-- they chose and people they invited. A pod belongs to one week, nobody owns
-- it, and next week everybody is somewhere else. Sharing a table would mean
-- every league query carrying a filter it does not want and half the columns
-- being null for one kind or the other.

-- ---------------------------------------------------------------------------
-- The ladder
-- ---------------------------------------------------------------------------

create table public.pod_tiers (
  tier text primary key,
  -- Where the ladder puts somebody, read from the rating on their profile.
  min_rating integer not null,
  sort_order integer not null unique,
  name text not null
);

insert into public.pod_tiers (tier, min_rating, sort_order, name) values
  ('bronze',  0,    1, 'Bronze'),
  ('silver',  1100, 2, 'Silver'),
  ('gold',    1300, 3, 'Gold'),
  ('diamond', 1500, 4, 'Diamond');

comment on table public.pod_tiers is
  'The ladder from section 2.2. A row per rung, so the bands can move without a migration to the code that reads them.';

/*
  Which rung a rating sits on. Always returns one: the bands start at zero, so
  there is no rating that belongs nowhere, and a new player at the default
  1000 lands in bronze.
*/
create or replace function public.tier_for_rating(p_rating integer)
returns text
language sql
stable
set search_path = public
as $$
  select tier
  from public.pod_tiers
  where min_rating <= greatest(coalesce(p_rating, 0), 0)
  order by min_rating desc
  limit 1
$$;

-- ---------------------------------------------------------------------------
-- pods
-- ---------------------------------------------------------------------------

create table public.pods (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.weekly_cycles (id) on delete cascade,
  tier text not null references public.pod_tiers (tier),

  -- Numbered within their tier and week, so a pod can be named without
  -- anybody having to name it: "Bronze pod 3".
  number integer not null,

  /*
    Section 2.2 says roughly twenty to thirty. Recorded per pod rather than
    read from a constant, so changing the target later cannot retroactively
    change what an existing pod allowed.
  */
  max_members integer not null default 30,

  created_at timestamptz not null default now(),
  -- Set when the week it belongs to has been scored and everybody moved.
  settled_at timestamptz,

  unique (cycle_id, tier, number),
  constraint pods_number_positive check (number > 0),
  constraint pods_size_sane check (max_members between 2 and 100)
);

create index pods_cycle_tier_idx on public.pods (cycle_id, tier);

comment on table public.pods is
  'One matchmade group for one week. Nobody owns it and it is not reused: next week everybody is placed again.';

-- ---------------------------------------------------------------------------
-- pod_members
-- ---------------------------------------------------------------------------

create table public.pod_members (
  id uuid primary key default gen_random_uuid(),
  pod_id uuid not null references public.pods (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,

  -- What the ladder said when they were placed. Kept so a pod's history reads
  -- correctly even after the rating has moved on.
  rating_at_placement integer not null,
  joined_at timestamptz not null default now(),

  /*
    Filled when the week is scored. Null while it runs, because a placing in a
    week still being played is a standing, not a result.
  */
  final_rank integer,
  outcome text check (outcome in ('promoted', 'held', 'relegated')),
  rating_change integer,

  unique (pod_id, user_id)
);

create index pod_members_pod_idx on public.pod_members (pod_id);
create index pod_members_user_idx on public.pod_members (user_id);

comment on column public.pod_members.outcome is
  'Where the week left them. Section 3 uses relegation for loss aversion, so it is recorded rather than recomputed.';

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.pod_tiers enable row level security;
alter table public.pods enable row level security;
alter table public.pod_members enable row level security;

create policy "the ladder is not a secret"
  on public.pod_tiers for select to authenticated using (true);

/*
  A pod is public in the sense that being in one is the point: everybody in it
  can see everybody else, the same way a league table works. Reading a pod you
  are not in is allowed too, because a ladder nobody can look up the rungs of
  is not a ladder. Neither exposes anything of a profile: names and pictures
  are joined on by the server, which decides what of a profile may be shown.
*/
create policy "pods are readable by signed-in players"
  on public.pods for select to authenticated using (true);

create policy "pod standings are readable by signed-in players"
  on public.pod_members for select to authenticated using (true);

-- No write policy on any of the three, for anybody. A placing somebody can
-- write is not a placing.

-- ---------------------------------------------------------------------------
-- place_in_pod
-- ---------------------------------------------------------------------------
-- Puts a player in a pod for the week, making one if every pod on their rung
-- is full.
--
-- Section 2.2: nobody ever faces a wait until Monday. This is called the first
-- time somebody looks at the game in a given week, the same way a portfolio
-- is, so there is always something to be in.
--
-- Idempotent: asking twice in a week returns the pod they are already in.

create or replace function public.place_in_pod(
  p_user_id uuid,
  p_cycle_id uuid,
  p_target_size integer default 24
)
returns public.pods
language plpgsql
security definer
set search_path = public
as $$
declare
  existing public.pods;
  chosen public.pods;
  player_rating integer;
  player_tier text;
begin
  -- Already placed this week. A second look is not a second pod.
  select p.* into existing
  from public.pods p
  join public.pod_members m on m.pod_id = p.id
  where p.cycle_id = p_cycle_id and m.user_id = p_user_id;

  if existing.id is not null then
    return existing;
  end if;

  select rating into player_rating from public.profiles where id = p_user_id;
  if player_rating is null then
    raise exception 'no such player';
  end if;

  player_tier := public.tier_for_rating(player_rating);

  /*
    The emptiest pod on their rung that still has room, so pods fill evenly
    rather than one reaching thirty while the next sits at two. Locked while
    it is chosen, because two people arriving at once must not both be given
    the last seat.
  */
  select p.* into chosen
  from public.pods p
  where p.cycle_id = p_cycle_id
    and p.tier = player_tier
    and (select count(*) from public.pod_members m where m.pod_id = p.id) < least(p.max_members, p_target_size)
  order by (select count(*) from public.pod_members m where m.pod_id = p.id) asc, p.number asc
  limit 1
  for update;

  if chosen.id is null then
    insert into public.pods (cycle_id, tier, number)
    values (
      p_cycle_id,
      player_tier,
      coalesce(
        (select max(number) + 1 from public.pods
         where cycle_id = p_cycle_id and tier = player_tier),
        1
      )
    )
    returning * into chosen;
  end if;

  insert into public.pod_members (pod_id, user_id, rating_at_placement)
  values (chosen.id, p_user_id, player_rating)
  on conflict (pod_id, user_id) do nothing;

  return chosen;
end;
$$;

-- ---------------------------------------------------------------------------
-- settle_pod
-- ---------------------------------------------------------------------------
-- Ranks one pod's finished week and moves everybody up, down or nowhere.
--
-- Ranked on points ahead of the market, which is what a week is scored on
-- everywhere else in the game. A pod does not invent a second way of deciding
-- who did well.
--
-- Idempotent: a pod that has already been settled is left alone, so a retry
-- after a crash cannot promote somebody twice.

create or replace function public.settle_pod(
  p_pod_id uuid,
  p_move_fraction numeric default 0.2,
  p_min_members integer default 8,
  p_rating_step integer default 60
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  pod public.pods;
  members integer;
  moving integer;
  ranked integer := 0;
begin
  select * into pod from public.pods where id = p_pod_id for update;
  if pod.id is null then
    raise exception 'unknown pod';
  end if;

  if pod.settled_at is not null then
    return 0;
  end if;

  select count(*) into members from public.pod_members where pod_id = p_pod_id;

  /*
    How many move at each end. A pod too small for this to mean anything moves
    nobody: relegating one of three people is not a ladder, it is a coin toss
    with a demotion attached, and section 2.2 warns that thin pods are the
    failure mode of this whole feature.
  */
  moving := case
    when members < p_min_members then 0
    else greatest(1, floor(members * p_move_fraction)::integer)
  end;

  with placings as (
    select
      m.id,
      row_number() over (order by p.benchmark_diff desc nulls last, m.joined_at asc) as place
    from public.pod_members m
    left join public.portfolios p
      on p.user_id = m.user_id and p.cycle_id = pod.cycle_id
    where m.pod_id = p_pod_id
  )
  update public.pod_members m
  set final_rank = placings.place,
      outcome = case
        when moving = 0 then 'held'
        when placings.place <= moving then 'promoted'
        when placings.place > members - moving then 'relegated'
        else 'held'
      end,
      rating_change = case
        when moving = 0 then 0
        when placings.place <= moving then p_rating_step
        when placings.place > members - moving then -p_rating_step
        else 0
      end
  from placings
  where m.id = placings.id;

  get diagnostics ranked = row_count;

  /*
    The rating follows the outcome, which is what puts somebody on a different
    rung next week. Floored at zero: a run of bad weeks should return you to
    bronze, not to a number that means nothing.
  */
  update public.profiles pr
  set rating = greatest(0, pr.rating + m.rating_change)
  from public.pod_members m
  where m.pod_id = p_pod_id
    and pr.id = m.user_id
    and coalesce(m.rating_change, 0) <> 0;

  update public.pods set settled_at = now() where id = p_pod_id;

  return ranked;
end;
$$;

-- ---------------------------------------------------------------------------
-- due_pods
-- ---------------------------------------------------------------------------
-- Pods whose week is scored and which have not been settled yet.

create or replace function public.due_pods()
returns setof public.pods
language sql
security definer
set search_path = public
as $$
  select p.*
  from public.pods p
  join public.weekly_cycles c on c.id = p.cycle_id
  where p.settled_at is null
    and c.status = 'closed'
  order by p.created_at asc
$$;

-- ---------------------------------------------------------------------------
-- Only the service role places or settles
-- ---------------------------------------------------------------------------

revoke all on function public.tier_for_rating(integer) from public, anon, authenticated;
revoke all on function public.place_in_pod(uuid, uuid, integer) from public, anon, authenticated;
revoke all on function public.settle_pod(uuid, numeric, integer, integer) from public, anon, authenticated;
revoke all on function public.due_pods() from public, anon, authenticated;

grant execute on function public.tier_for_rating(integer) to service_role;
grant execute on function public.place_in_pod(uuid, uuid, integer) to service_role;
grant execute on function public.settle_pod(uuid, numeric, integer, integer) to service_role;
grant execute on function public.due_pods() to service_role;
