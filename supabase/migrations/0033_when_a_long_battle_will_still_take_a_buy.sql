-- Upside Arena: when a long battle will still take a buy.
--
-- A quarter or a year used to be the same game as a week, just longer: the
-- book was open every session, or it was drafted and never opened again. The
-- first of those rewards the person who fiddles most. The second is a lock-in
-- that, twelve months on, nobody still wants to be in. Friends starting a
-- year together need a third thing: days when the book may change, and a long
-- stretch between them when it may not.
--
-- `cadence` is that third thing. It lives on the cycle next to format and
-- length, because those three are the whole of what a battle is. Default is
-- `always`, so a battle started before this exists is the battle it always
-- was, and a host who does not pick one gets the open book.
--
-- Selling is not gated here. A window that trapped somebody in a name would
-- be a punishment, and Arena does not do that. The application checks a buy
-- against the calendar the same way it checks a buy against a format: in
-- TypeScript, at the moment of the trade. The column is what was agreed, so
-- a screen can say when the next morning is without inferring it from the
-- length.
--
-- create_battle takes the new argument with a default, so every existing
-- caller still starts an open book. The old ten-parameter overload is dropped
-- in the same file, which is what lets the migration checker see this as a
-- create rather than as a body replacement it cannot judge.
--
-- Allowed values are the ids in src/lib/game/cadence.ts. Unknown ones are
-- refused here so a typo cannot start a contest whose screen cannot explain
-- it.

alter table public.weekly_cycles
  add column if not exists cadence text not null default 'always';

alter table public.weekly_cycles
  drop constraint if exists weekly_cycles_cadence_check;

alter table public.weekly_cycles
  add constraint weekly_cycles_cadence_check
  check (cadence in ('always', 'mondays', 'monthly', 'quarterly', 'once', 'bell'));

comment on column public.weekly_cycles.cadence is
  'When this contest will take a buy. Selling is never gated by it. always is the open book.';

drop function if exists public.create_battle(uuid, uuid, text, text, text, date, date, numeric, text, numeric);

create or replace function public.create_battle(
  p_user_id uuid,
  p_league_id uuid,
  p_format text,
  p_direction text,
  p_length text,
  p_starts_on date,
  p_ends_on date,
  p_starting_balance numeric,
  p_benchmark_symbol text,
  p_benchmark_open numeric default null,
  p_cadence text default 'always'
)
returns public.weekly_cycles
language plpgsql
security definer
set search_path = public
as $$
declare
  cycle public.weekly_cycles;
begin
  if not public.is_league_member(p_league_id, p_user_id) then
    raise exception 'not a member of that league';
  end if;

  if p_ends_on < p_starts_on then
    raise exception 'a battle cannot end before it starts';
  end if;

  if p_cadence not in ('always', 'mondays', 'monthly', 'quarterly', 'once', 'bell') then
    raise exception 'unknown cadence';
  end if;

  -- Checked here as well as by the index below it, so the caller gets a
  -- sentence rather than a constraint name.
  if exists (
    select 1 from public.weekly_cycles
    where league_id = p_league_id and status <> 'closed'
  ) then
    raise exception 'this league already has a battle running';
  end if;

  insert into public.weekly_cycles (
    monday, ends_on, status, format, direction, length, cadence,
    league_id, created_by, benchmark_symbol, benchmark_open, starting_balance
  )
  values (
    p_starts_on, p_ends_on, 'open', p_format, p_direction, p_length, p_cadence,
    p_league_id, p_user_id, p_benchmark_symbol, p_benchmark_open,
    p_starting_balance
  )
  returning * into cycle;

  return cycle;
exception
  when unique_violation then
    raise exception 'this league already has a battle running';
end;
$$;

revoke all on function public.create_battle(uuid, uuid, text, text, text, date, date, numeric, text, numeric, text)
  from public, anon, authenticated;

grant execute on function public.create_battle(uuid, uuid, text, text, text, date, date, numeric, text, numeric, text) to service_role;
