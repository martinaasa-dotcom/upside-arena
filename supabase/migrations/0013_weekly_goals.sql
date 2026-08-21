-- Upside Arena, section 3.8: public commitment.
--
-- Saying out loud what you are going to do this week measurably increases the
-- chance you do it, and saying it to four people who will see whether you did
-- increases it more. That is the whole mechanic.
--
-- Two decisions worth writing down, because both are load-bearing:
--
--   1. A goal is chosen from a fixed set, never typed. Free text inside a
--      league is a moderation surface, and this product has no moderation
--      tooling and a sixteen year old minimum age. A commitment does not need
--      to be in somebody's own words to be a commitment.
--
--   2. It is set once for the week and cannot be swapped. A goal you can
--      quietly change on Friday afternoon once you know how the week went is
--      not a commitment, it is a scoreboard you drew afterwards. Withdrawing
--      it entirely is allowed, because holding somebody to something they no
--      longer want to be held to is not a mechanic, it is a trap.
--
-- Nothing here touches scoring. Meeting a goal earns nothing, and missing one
-- costs nothing.

create table public.weekly_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  league_id uuid not null references public.leagues (id) on delete cascade,
  cycle_id uuid not null references public.weekly_cycles (id) on delete cascade,

  kind text not null check (
    kind in ('beat_market', 'finish_up', 'top_three', 'every_day')
  ),

  declared_at timestamptz not null default now(),

  -- One per person per league per week. This is what makes it a commitment
  -- rather than a running list of things somebody might do.
  unique (user_id, league_id, cycle_id)
);

create index weekly_goals_league_cycle_idx
  on public.weekly_goals (league_id, cycle_id);

comment on table public.weekly_goals is
  'What somebody said they would do this week, in front of their league. Affects no score.';

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.weekly_goals enable row level security;

/*
  A goal is read by the league it was declared to and by nobody else. Declaring
  something in front of four people is not the same as publishing it, and the
  difference is the entire reason the mechanic works.
*/
create policy "a league reads the goals declared to it"
  on public.weekly_goals for select
  to authenticated
  using (public.is_league_member(league_id, auth.uid()));

/*
  Withdrawing is the one thing a player does directly, because it is the one
  thing that can only ever take something away from them. Everything else goes
  through the function below.
*/
create policy "a player withdraws their own goal"
  on public.weekly_goals for delete
  to authenticated
  using (auth.uid() = user_id);

-- No insert or update policy for a player. A goal that could be edited after
-- the week is not a goal.

-- ---------------------------------------------------------------------------
-- declare_goal
-- ---------------------------------------------------------------------------

create or replace function public.declare_goal(
  p_user_id uuid,
  p_league_id uuid,
  p_cycle_id uuid,
  p_kind text
)
returns public.weekly_goals
language plpgsql
security definer
set search_path = public
as $$
declare
  goal public.weekly_goals;
begin
  -- Membership is checked here rather than assumed from the request. A league
  -- id is not a secret, and guessing one must not be a way to post into a
  -- league you are not in.
  if not public.is_league_member(p_league_id, p_user_id) then
    raise exception 'not a member of that league';
  end if;

  insert into public.weekly_goals (user_id, league_id, cycle_id, kind)
  values (p_user_id, p_league_id, p_cycle_id, p_kind)
  returning * into goal;

  return goal;
exception
  when unique_violation then
    raise exception 'already declared a goal for this week';
end;
$$;

revoke all on function public.declare_goal(uuid, uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.declare_goal(uuid, uuid, uuid, text) to service_role;
