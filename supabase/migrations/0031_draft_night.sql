-- Upside Arena: draft night. The one thing here that happens to several people
-- at the same moment.
--
-- Everything else in this app is somebody alone with a phone. A trade is
-- yours, a lineup is yours, and a battle is five people playing the same week
-- separately and finding out on Friday. That separateness is deliberate and it
-- is defended in books.sql's reveal rule: showing a live book would be a
-- copying machine and a league would converge on one portfolio by Wednesday.
--
-- A draft is the case that rule does not cover, and it is worth being precise
-- about why, because at a glance it looks like exactly the thing that was
-- refused. Seeing what somebody else picked is only a copying machine when you
-- can go and buy it too. Here you cannot: a name that has been taken is off
-- the board for everybody else. Made public as it happens, a pick is not
-- information to copy, it is information to plan against, and the whole
-- evening is the five seconds after somebody takes the name you wanted.
--
-- So the picks are public and live, and nothing about the reveal rule moves.
--
-- The shape, and the reason it is this shape:
--
--   1. A draft is a battle. The same trick 0017 played, for the same reason:
--      a battle is a weekly_cycle with a league on it, so portfolios,
--      holdings, the trade log, settlement and every row level security policy
--      already key on a cycle. A drafted battle is a cycle with a draft
--      attached, and the engine still does not know the difference.
--
--   2. The board is enforced by a unique index, not by a screen. Two people
--      tapping the same company in the same second is the ordinary case in a
--      room, not the exotic one, and "the button was greyed out" is not a
--      rule. draft_picks_symbol_idx is what actually decides it, and the loser
--      of that race is told the name has gone rather than being handed a
--      duplicate.
--
--   3. The running order is written down before the first pick, one row per
--      turn. It could have been computed on demand from a seat count and a
--      pick number, and then the snake arithmetic would exist twice, once in
--      SQL and once in the TypeScript the room renders from, which is two
--      copies that are supposed to agree. Instead src/lib/game/draft-order.ts
--      works it out once, it is stored, and this file enforces the two things
--      a browser must never be trusted with: that the row belongs to the
--      person filling it, and that the name is still there.
--
--      What is checked here rather than taken on trust is the fairness
--      property, which is that every seated player appears exactly as many
--      times as everybody else. A running order that gave one seat an extra
--      pick would be a contest decided before it started, and that is not a
--      thing to leave to a caller.
--
--   4. You hold what you drafted. A drafted battle takes no trades at all,
--      and that is enforced in execute_trade rather than by hiding the form.
--      Without it the exclusivity is theatre: the board runs out at nine on
--      Sunday and at 09:31 on Monday anybody can sell what they drafted and
--      buy what they actually wanted, which is the ordinary week with a
--      ceremony in front of it.
--
--   5. Everybody fills at the same opening price, which is the lineup's rule
--      (0018) and is here for the lineup's reason. Picking first must be an
--      advantage in *choice* and in nothing else, and the snake order is what
--      answers the choice half. If the first pick also filled at Sunday's
--      price it would be an advantage in money as well, and no seat order
--      could fix that.

-- ---------------------------------------------------------------------------
-- A cycle can be one you drafted
-- ---------------------------------------------------------------------------

alter table public.weekly_cycles
  add column drafted boolean not null default false;

comment on column public.weekly_cycles.drafted is
  'True for a battle whose holdings were drafted. It takes no trades: you hold what you drafted.';

-- ---------------------------------------------------------------------------
-- drafts
-- ---------------------------------------------------------------------------

create table public.drafts (
  id uuid primary key default gen_random_uuid(),

  -- The battle this fills. One each way: a cycle has at most one draft, and a
  -- draft is for exactly one cycle. Deleting the battle takes the draft with
  -- it, which is what makes calling one off a single delete.
  cycle_id uuid not null unique references public.weekly_cycles (id) on delete cascade,
  league_id uuid not null references public.leagues (id) on delete cascade,

  /*
    waiting  the lobby. People are joining, nothing is decided, no seats dealt.
    picking  the running order exists and there is a turn live.
    picked   every turn is taken. Nothing is owned yet: the market is shut.
    filled   the picks were bought at the opening price. The battle is running.

    A draft never goes backwards, and there is no 'cancelled': one that is
    called off is deleted along with its cycle, exactly as a cancelled battle
    is. A draft nobody finished did not happen.
  */
  status text not null default 'waiting'
    check (status in ('waiting', 'picking', 'picked', 'filled')),

  -- Picks each. Not the number of picks in total, which depends on how many
  -- people turn up, and turning up is what the lobby is for.
  rounds integer not null check (rounds between 1 and 12),

  -- The clock, in seconds. A turn that runs out is taken by the board's first
  -- remaining name rather than skipped: see clock_pick.
  pick_seconds integer not null check (pick_seconds between 10 and 600),

  -- Which turn is live, zero based, and when it stops being theirs. Null
  -- deadline while the lobby is open, because there is no turn yet.
  current_pick integer not null default 0 check (current_pick >= 0),
  deadline timestamptz,

  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  picked_at timestamptz,
  filled_at timestamptz
);

create index drafts_league_idx on public.drafts (league_id);

comment on table public.drafts is
  'A league picking a battle''s holdings in turn, one name at a time, off a board that runs out.';

-- ---------------------------------------------------------------------------
-- draft_seats
-- ---------------------------------------------------------------------------
/*
  Who is actually here.

  A league is not a room. Eight people are in the league and five are round
  the table, and a draft that seated all eight would deal three of them a
  portfolio of nothing and then rank them against the people who played. Worse
  than looking untidy: in a week the market falls, doing nothing wins, so the
  three who were not invited would take the top three places.

  So attendance is its own act. Everybody in the league can see the lobby and
  join it while it is open, and the contest is between the people who sat down.
*/
create table public.draft_seats (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null references public.drafts (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,

  -- Where they sit, dealt at random when the draft starts. Null in the lobby,
  -- because until it starts there is no order and pretending there is one
  -- invites somebody to leave and rejoin for a better seat.
  seat integer check (seat >= 0),

  joined_at timestamptz not null default now(),

  unique (draft_id, user_id)
);

create unique index draft_seats_one_per_seat_idx
  on public.draft_seats (draft_id, seat)
  where seat is not null;

create index draft_seats_user_idx on public.draft_seats (user_id);

-- ---------------------------------------------------------------------------
-- draft_picks
-- ---------------------------------------------------------------------------
/*
  The running order, and then what was taken with it.

  Every row exists before the first pick is made, with a turn number and the
  person whose turn it is, and a null symbol. That is what makes "whose turn is
  it" a primary key lookup rather than arithmetic, and it is what lets the room
  show the whole order down the side of the screen while it is still empty,
  which is most of what makes a draft watchable for the four people who are not
  currently picking.

  The fill columns are the lineup's, and deliberately the same words: an order
  that could not be run says so rather than disappearing.
*/
create table public.draft_picks (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null references public.drafts (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,

  -- Zero based, and its position in the whole draft rather than in a round.
  pick_number integer not null check (pick_number >= 0),

  -- Null until it is taken.
  symbol text check (symbol ~ '^[A-Z0-9.\-]{1,12}$'),
  picked_at timestamptz,

  -- True when the clock took it, which is said on screen. Somebody who was
  -- getting a drink should be able to see why they own something.
  by_clock boolean not null default false,

  -- What happened on the Monday. Null until the fill runs.
  filled_at timestamptz,
  outcome text check (outcome in ('filled', 'no_price', 'not_enough_cash', 'refused')),
  shares numeric(18, 4),
  fill_price numeric(18, 6),
  detail text,

  unique (draft_id, pick_number)
);

/*
  The board, and the whole of it.

  A partial index so that the empty turns, which are all null and all
  duplicates of each other, do not collide, and so that the moment a name is
  written down nobody else in this draft can write it. This is the rule. The
  greyed-out tile on the board is a courtesy.
*/
create unique index draft_picks_symbol_idx
  on public.draft_picks (draft_id, symbol)
  where symbol is not null;

create index draft_picks_draft_idx on public.draft_picks (draft_id, pick_number);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
-- Readable by the league, writable by nobody. Every write here decides a
-- contest, so every write is a function the server calls.

alter table public.drafts enable row level security;
alter table public.draft_seats enable row level security;
alter table public.draft_picks enable row level security;

create policy "a draft is readable by its league"
  on public.drafts for select
  to authenticated
  using (public.is_league_member(league_id, auth.uid()));

create policy "seats are readable by the league"
  on public.draft_seats for select
  to authenticated
  using (
    exists (
      select 1 from public.drafts d
      where d.id = draft_id and public.is_league_member(d.league_id, auth.uid())
    )
  );

create policy "picks are readable by the league"
  on public.draft_picks for select
  to authenticated
  using (
    exists (
      select 1 from public.drafts d
      where d.id = draft_id and public.is_league_member(d.league_id, auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- create_draft
-- ---------------------------------------------------------------------------
/*
  Opening the lobby, which also creates the battle it will fill.

  The battle exists from this moment rather than from the first pick, and that
  is not an implementation convenience: weekly_cycles_one_live_battle_idx is
  what stops a league running two contests at once, and a league that could
  open a draft while a battle ran, or start a battle halfway through a draft,
  would have two scoreboards and no conversation. One index covers both because
  a draft is a battle.

  Any member may open one, the same rule create_battle has and for the reason
  written there.
*/
create or replace function public.create_draft(
  p_user_id uuid,
  p_league_id uuid,
  p_format text,
  p_direction text,
  p_length text,
  p_starts_on date,
  p_ends_on date,
  p_starting_balance numeric,
  p_benchmark_symbol text,
  p_benchmark_open numeric,
  p_rounds integer,
  p_pick_seconds integer
)
returns public.drafts
language plpgsql
security definer
set search_path = public
as $$
declare
  cycle public.weekly_cycles;
  draft public.drafts;
begin
  if not public.is_league_member(p_league_id, p_user_id) then
    raise exception 'not a member of that league';
  end if;

  if p_ends_on < p_starts_on then
    raise exception 'a battle cannot end before it starts';
  end if;

  if exists (
    select 1 from public.weekly_cycles
    where league_id = p_league_id and status <> 'closed'
  ) then
    raise exception 'this league already has a battle running';
  end if;

  insert into public.weekly_cycles (
    monday, ends_on, status, format, direction, length,
    league_id, created_by, benchmark_symbol, benchmark_open, starting_balance,
    drafted
  )
  values (
    p_starts_on, p_ends_on, 'open', p_format, p_direction, p_length,
    p_league_id, p_user_id, p_benchmark_symbol, p_benchmark_open,
    p_starting_balance, true
  )
  returning * into cycle;

  insert into public.drafts (
    cycle_id, league_id, rounds, pick_seconds, created_by
  )
  values (cycle.id, p_league_id, p_rounds, p_pick_seconds, p_user_id)
  returning * into draft;

  -- Whoever opens it is in it. Opening a lobby you are not in and then being
  -- asked to join it is a question with one answer.
  insert into public.draft_seats (draft_id, user_id)
  values (draft.id, p_user_id);

  return draft;
exception
  when unique_violation then
    raise exception 'this league already has a battle running';
end;
$$;

-- ---------------------------------------------------------------------------
-- join_draft / leave_draft
-- ---------------------------------------------------------------------------

create or replace function public.join_draft(
  p_user_id uuid,
  p_draft_id uuid,
  p_max_seats integer
)
returns public.draft_seats
language plpgsql
security definer
set search_path = public
as $$
declare
  draft public.drafts;
  seat public.draft_seats;
  taken integer;
begin
  select * into draft from public.drafts where id = p_draft_id for update;

  if draft.id is null then
    raise exception 'no such draft';
  end if;

  if draft.status <> 'waiting' then
    raise exception 'this draft has already started';
  end if;

  if not public.is_league_member(draft.league_id, p_user_id) then
    raise exception 'not a member of that league';
  end if;

  select count(*) into taken from public.draft_seats where draft_id = p_draft_id;

  if taken >= p_max_seats then
    raise exception 'this draft is full';
  end if;

  insert into public.draft_seats (draft_id, user_id)
  values (p_draft_id, p_user_id)
  on conflict (draft_id, user_id) do update set draft_id = excluded.draft_id
  returning * into seat;

  return seat;
end;
$$;

/*
  Leaving, which only means anything in the lobby.

  Once the order is dealt a seat cannot be given back: every turn after it
  belongs to somebody, and removing one would either shorten everybody else's
  draft or hand a stranger's picks to the person sitting next to them. Somebody
  who leaves the room after it has started has their turns taken by the clock,
  which is what the clock is for.

  The person who opened it cannot leave, because a lobby with no owner is a
  lobby nobody can call off. They call it off instead.
*/
create or replace function public.leave_draft(
  p_user_id uuid,
  p_draft_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  draft public.drafts;
  removed integer;
begin
  select * into draft from public.drafts where id = p_draft_id for update;

  if draft.id is null then
    raise exception 'no such draft';
  end if;

  if draft.status <> 'waiting' then
    raise exception 'this draft has already started';
  end if;

  if draft.created_by = p_user_id then
    raise exception 'the person who opened it calls it off rather than leaving';
  end if;

  delete from public.draft_seats
  where draft_id = p_draft_id and user_id = p_user_id;

  get diagnostics removed = row_count;
  return removed > 0;
end;
$$;

-- ---------------------------------------------------------------------------
-- start_draft
-- ---------------------------------------------------------------------------
/*
  Dealing the seats and writing the running order down.

  p_seat_order is the seated players shuffled, and p_picks is the whole draft
  turn by turn: the snake the caller built from that shuffle. Both come from
  the server rather than being worked out here, for the reason at the top of
  this file, and neither is taken on trust.

  What is checked:

    Everybody who is seated is in the order exactly once.
    The order and the picks describe the same set of people.
    Every one of them picks exactly `rounds` times.
    The board is big enough that the last turn still has something on it.

  The last one needs a number this database does not have, because the boards
  are lists in src/lib/game/formats.ts and a table claiming to describe them
  would be a second and quieter version of them. So the caller passes the size,
  exactly as queue_lineup_order is passed p_locked, and for the same reason:
  the caller is the only party that knows.
*/
create or replace function public.start_draft(
  p_user_id uuid,
  p_draft_id uuid,
  p_seat_order uuid[],
  p_picks uuid[],
  p_board_size integer,
  p_min_seats integer,
  p_max_seats integer,
  p_now timestamptz
)
returns public.drafts
language plpgsql
security definer
set search_path = public
as $$
declare
  draft public.drafts;
  seats integer;
  seated integer;
  expected integer;
  i integer;
begin
  select * into draft from public.drafts where id = p_draft_id for update;

  if draft.id is null then
    raise exception 'no such draft';
  end if;

  if draft.created_by is distinct from p_user_id then
    raise exception 'only the person who opened it can start it';
  end if;

  if draft.status <> 'waiting' then
    raise exception 'this draft has already started';
  end if;

  seats := array_length(p_seat_order, 1);
  if seats is null then seats := 0; end if;

  if seats < p_min_seats then
    raise exception 'a draft needs at least % people', p_min_seats;
  end if;

  if seats > p_max_seats then
    raise exception 'a draft holds at most % people', p_max_seats;
  end if;

  -- The order is the room, and the room is the order. Neither may carry
  -- somebody the other does not.
  select count(*) into seated from public.draft_seats where draft_id = p_draft_id;

  if seated <> seats then
    raise exception 'the seating does not match who is here';
  end if;

  if exists (
    select 1 from public.draft_seats
    where draft_id = p_draft_id and user_id <> all (p_seat_order)
  ) then
    raise exception 'the seating does not match who is here';
  end if;

  if (select count(distinct u) from unnest(p_seat_order) as u) <> seats then
    raise exception 'somebody is seated twice';
  end if;

  expected := seats * draft.rounds;

  if coalesce(array_length(p_picks, 1), 0) <> expected then
    raise exception 'the running order is the wrong length';
  end if;

  if expected > p_board_size then
    raise exception 'the board is too small for % people and % rounds', seats, draft.rounds;
  end if;

  /*
    Everybody picks the same number of times.

    This is the one property of a running order that decides a contest, so it
    is checked here rather than trusted to whoever built it. The *sequence* is
    the snake and lives in draft-order.ts, which is pure and has tests; a
    sequence that is fair but in the wrong order is a worse draft, and a
    sequence that is unfair is not a draft at all.
  */
  if exists (
    select 1
    from unnest(p_picks) as p(user_id)
    group by p.user_id
    having count(*) <> draft.rounds
  ) then
    raise exception 'the running order does not give everybody the same number of picks';
  end if;

  for i in 1 .. seats loop
    update public.draft_seats
    set seat = i - 1
    where draft_id = p_draft_id and user_id = p_seat_order[i];
  end loop;

  for i in 1 .. expected loop
    insert into public.draft_picks (draft_id, user_id, pick_number)
    values (p_draft_id, p_picks[i], i - 1);
  end loop;

  update public.drafts
  set status = 'picking',
      started_at = p_now,
      current_pick = 0,
      deadline = p_now + make_interval(secs => draft.pick_seconds)
  where id = p_draft_id
  returning * into draft;

  return draft;
end;
$$;

-- ---------------------------------------------------------------------------
-- make_pick
-- ---------------------------------------------------------------------------
/*
  Taking a name.

  Everything that decides whether this is allowed happens under a lock on the
  draft row, because the ordinary case for this function is two phones in the
  same room hitting it inside the same second.

  The unique index is what refuses the second one, and it is refused with the
  sentence rather than a constraint name, because "NVDA has gone" is the whole
  drama of a draft and deserves to arrive as words.
*/
create or replace function public.make_pick(
  p_user_id uuid,
  p_draft_id uuid,
  p_symbol text,
  p_now timestamptz
)
returns public.draft_picks
language plpgsql
security definer
set search_path = public
as $$
declare
  draft public.drafts;
  turn public.draft_picks;
  symbol text := upper(btrim(p_symbol));
begin
  select * into draft from public.drafts where id = p_draft_id for update;

  if draft.id is null then
    raise exception 'no such draft';
  end if;

  if draft.status <> 'picking' then
    raise exception 'this draft is not taking picks';
  end if;

  select * into turn
  from public.draft_picks
  where draft_id = p_draft_id and pick_number = draft.current_pick
  for update;

  if turn.id is null then
    raise exception 'this draft is not taking picks';
  end if;

  if turn.user_id is distinct from p_user_id then
    raise exception 'it is not your turn';
  end if;

  return public.take_pick(draft, turn, symbol, false, p_now);
end;
$$;

-- ---------------------------------------------------------------------------
-- clock_pick
-- ---------------------------------------------------------------------------
/*
  The turn nobody took.

  A draft has to survive somebody putting their phone down, and a room of five
  where one person has wandered off is four people who can do nothing at all.
  So when a turn runs out the board's first remaining name is taken for them.

  Two decisions worth their sentences. It **picks rather than skips**: skipping
  quietly hands that person a smaller portfolio than everybody else and then
  ranks them against it, which is a worse outcome than a name they did not
  choose. And the name is the **first still standing in the board's own order**,
  which is the order it has been on screen in all evening, so the pick is one
  anybody in the room could have called a second before it happened. A random
  one would be the app inventing a decision nobody made.

  It takes no user id. Anybody's screen may call it, and it will do nothing
  unless the deadline has really passed, which is what makes it safe to fire
  from five phones at once: the first one moves the draft on and the other four
  find a turn that is no longer live.
*/
create or replace function public.clock_pick(
  p_draft_id uuid,
  p_symbol text,
  p_now timestamptz
)
returns public.draft_picks
language plpgsql
security definer
set search_path = public
as $$
declare
  draft public.drafts;
  turn public.draft_picks;
  symbol text := upper(btrim(p_symbol));
begin
  select * into draft from public.drafts where id = p_draft_id for update;

  if draft.id is null or draft.status <> 'picking' then
    return null;
  end if;

  if draft.deadline is null or draft.deadline > p_now then
    return null;
  end if;

  select * into turn
  from public.draft_picks
  where draft_id = p_draft_id and pick_number = draft.current_pick
  for update;

  if turn.id is null or turn.symbol is not null then
    return null;
  end if;

  return public.take_pick(draft, turn, symbol, true, p_now);
end;
$$;

-- ---------------------------------------------------------------------------
-- take_pick
-- ---------------------------------------------------------------------------
/*
  What both of them do once they have decided it is allowed.

  One function rather than two copies, because the part that moves the draft on
  -- write the name, advance the turn, reset the clock, notice the end -- is
  the part where an inconsistency between the player's path and the clock's
  path would be a draft that behaves differently depending on who was awake.

  Not callable from outside. It takes rows that have already been locked and
  checked, and it checks neither.
*/
create or replace function public.take_pick(
  draft public.drafts,
  turn public.draft_picks,
  p_symbol text,
  p_by_clock boolean,
  p_now timestamptz
)
returns public.draft_picks
language plpgsql
security definer
set search_path = public
as $$
declare
  picked public.draft_picks;
  total integer;
  next_pick integer;
begin
  if p_symbol is null or p_symbol = '' then
    raise exception 'pick a name';
  end if;

  begin
    update public.draft_picks
    set symbol = p_symbol,
        picked_at = p_now,
        by_clock = p_by_clock
    where id = turn.id
    returning * into picked;
  exception
    when unique_violation then
      raise exception '% has gone. Somebody got there first.', p_symbol;
  end;

  select count(*) into total from public.draft_picks where draft_id = draft.id;
  next_pick := draft.current_pick + 1;

  if next_pick >= total then
    update public.drafts
    set status = 'picked',
        current_pick = next_pick,
        deadline = null,
        picked_at = p_now
    where id = draft.id;
  else
    update public.drafts
    set current_pick = next_pick,
        deadline = p_now + make_interval(secs => draft.pick_seconds)
    where id = draft.id;
  end if;

  return picked;
end;
$$;

-- ---------------------------------------------------------------------------
-- cancel_draft
-- ---------------------------------------------------------------------------
/*
  Calling it off, which deletes the battle with it. A draft nobody finished did
  not happen, exactly as a cancelled battle did not.

  Two people may do it, and the difference is where the evening got to.
  **Before it starts, any of the people sitting in it can**, because a lobby
  somebody opened and then went to bed on would otherwise hold the league's one
  battle slot open forever with nobody able to clear it. Once the picking has
  begun it is the opener's alone: at that point there are results in the room,
  and somebody who does not like the way the board is going does not get to
  wipe it.

  A filled draft cannot be called off at all. By then it is a battle with money
  in it, and cancel_battle's rule applies rather than this one.
*/
create or replace function public.cancel_draft(
  p_user_id uuid,
  p_draft_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  draft public.drafts;
begin
  select * into draft from public.drafts where id = p_draft_id for update;

  if draft.id is null then
    raise exception 'no such draft';
  end if;

  if draft.status = 'filled' then
    raise exception 'that draft has already been bought';
  end if;

  if draft.status = 'waiting' then
    if not exists (
      select 1 from public.draft_seats
      where draft_id = p_draft_id and user_id = p_user_id
    ) then
      raise exception 'only somebody in the draft can call it off';
    end if;
  elsif draft.created_by is distinct from p_user_id then
    raise exception 'only the person who opened it can call it off now';
  end if;

  delete from public.weekly_cycles where id = draft.cycle_id;
  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- fill_draft
-- ---------------------------------------------------------------------------
/*
  Monday morning. Everything that was picked is bought at the opening price.

  The lineup's shape (0018) and the lineup's promises: one transaction, each
  order in its own block so one that cannot be afforded does not roll back the
  ones that worked, and nothing dropped quietly. What is different is that the
  share count is worked out here rather than queued, because on Sunday evening
  nobody knows what anything will open at, and the whole point of an equally
  weighted draft is that every pick is the same size in money.

  p_budget is what one pick is worth, which is the starting balance divided by
  the number of rounds. Passed in rather than divided here so that the number
  on the screen on Sunday and the number spent on Monday are the same number,
  computed once, in src/lib/game/draft-order.ts.

  Ordered by pick number, so if anything does run short it runs short at the
  end of somebody's own list rather than at a place that depends on how the
  rows happen to be stored.

  Idempotent, on the same rule as the lineup: only picks that have not been
  filled are considered, and a pick is marked filled in the same transaction as
  the trade it caused.
*/
create or replace function public.fill_draft(
  p_draft_id uuid,
  p_prices jsonb,
  p_budget numeric,
  p_today date default null
)
returns setof public.draft_picks
language plpgsql
security definer
set search_path = public
as $$
declare
  draft public.drafts;
  pick public.draft_picks;
  price numeric(18, 6);
  quantity numeric(18, 4);
begin
  select * into draft from public.drafts where id = p_draft_id for update;

  if draft.id is null then
    raise exception 'no such draft';
  end if;

  if draft.status not in ('picked', 'filled') then
    raise exception 'this draft has not finished picking';
  end if;

  for pick in
    select *
    from public.draft_picks
    where draft_id = p_draft_id and symbol is not null and filled_at is null
    order by pick_number asc
    for update
  loop
    price := nullif(p_prices ->> pick.symbol, '')::numeric;

    if price is null or price <= 0 then
      update public.draft_picks
      set filled_at = now(),
          outcome = 'no_price',
          detail = 'We had no opening price for ' || pick.symbol || ' that morning.'
      where id = pick.id
      returning * into pick;

      return next pick;
      continue;
    end if;

    quantity := trunc(p_budget / price);

    /*
      A pick whose budget will not buy one share.

      It is a real case and not an error: a pick is worth the starting balance
      over the rounds, and a share of a company can cost more than that. Said
      plainly rather than recorded as a refusal, because nothing went wrong.
    */
    if quantity < 1 then
      update public.draft_picks
      set filled_at = now(),
          outcome = 'not_enough_cash',
          fill_price = price,
          detail = pick.symbol || ' opened above what one pick is worth, so none was bought.'
      where id = pick.id
      returning * into pick;

      return next pick;
      continue;
    end if;

    begin
      perform public.execute_trade(
        pick.user_id, draft.cycle_id, pick.symbol, 'buy',
        quantity, price, 2147483647, 2147483647, p_today, true
      );

      update public.draft_picks
      set filled_at = now(),
          outcome = 'filled',
          shares = quantity,
          fill_price = price,
          detail = null
      where id = pick.id
      returning * into pick;
    exception
      when others then
        update public.draft_picks
        set filled_at = now(),
            outcome = case
              when sqlerrm like '%not enough cash%' then 'not_enough_cash'
              else 'refused'
            end,
            fill_price = price,
            detail = sqlerrm
        where id = pick.id
        returning * into pick;
    end;

    return next pick;
  end loop;

  update public.drafts
  set status = 'filled',
      filled_at = coalesce(filled_at, now())
  where id = p_draft_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- execute_trade, which now knows a drafted battle takes no trades
-- ---------------------------------------------------------------------------
/*
  One rule added and nothing else about a trade moves.

  You hold what you drafted. Without this the board is theatre: it runs out at
  nine on Sunday, and at 09:31 on Monday anybody can sell what they drafted and
  buy the name somebody else took, which is the ordinary week with a ceremony in
  front of it.

  p_drafted_ok is how fill_draft gets past its own rule, and it is the last
  argument with a default of false so that every existing caller -- the trade
  form, fill_lineup, the tests -- is refused by default and has to say
  otherwise. A flag that defaults to permitting the thing it guards is not a
  guard.
*/
create or replace function public.execute_trade(
  p_user_id uuid,
  p_cycle_id uuid,
  p_symbol text,
  p_side text,
  p_quantity numeric,
  p_price numeric,
  p_max_per_minute integer default 10,
  p_max_per_cycle integer default 500,
  p_today date default null,
  p_drafted_ok boolean default false
)
returns public.trades
language plpgsql
security definer
set search_path = public
as $$
declare
  cycle public.weekly_cycles;
  portfolio public.portfolios;
  holding public.holdings;
  trade public.trades;
  gross numeric(18, 2);
  proceeds numeric(18, 2);
  recent integer;
  total integer;
  sold_cost numeric(18, 2);
begin
  if p_side not in ('buy', 'sell') then
    raise exception 'side must be buy or sell';
  end if;

  if p_quantity is null or p_quantity <= 0 or p_quantity <> trunc(p_quantity) then
    raise exception 'quantity must be a whole number of shares';
  end if;

  if p_price is null or p_price <= 0 then
    raise exception 'price must be positive';
  end if;

  select * into cycle from public.weekly_cycles where id = p_cycle_id;
  if cycle.id is null then
    raise exception 'unknown cycle';
  end if;

  if cycle.status <> 'open' then
    raise exception 'this week is closed for trading';
  end if;

  if cycle.drafted and not p_drafted_ok then
    raise exception 'you hold what you drafted';
  end if;

  if p_today is not null then
    if p_today < cycle.monday then
      raise exception 'this contest has not started yet';
    end if;
    if p_today > cycle.ends_on then
      raise exception 'this week is closed for trading';
    end if;
  end if;

  if cycle.league_id is not null
     and not public.is_league_member(cycle.league_id, p_user_id) then
    raise exception 'not a member of that league';
  end if;

  portfolio := public.ensure_portfolio(p_user_id, p_cycle_id);

  select * into portfolio
  from public.portfolios
  where id = portfolio.id
  for update;

  select count(*) into recent
  from public.trades
  where portfolio_id = portfolio.id
    and executed_at > now() - interval '1 minute';

  if recent >= p_max_per_minute then
    raise exception 'too many trades, slow down';
  end if;

  select count(*) into total
  from public.trades
  where portfolio_id = portfolio.id;

  if total >= p_max_per_cycle then
    raise exception 'trade limit for this week reached';
  end if;

  gross := round(p_quantity * p_price, 2);

  select * into holding
  from public.holdings
  where portfolio_id = portfolio.id and symbol = p_symbol
  for update;

  if p_side = 'buy' then
    if gross > portfolio.cash then
      raise exception 'not enough cash';
    end if;

    update public.portfolios
    set cash = cash - gross
    where id = portfolio.id;

    if holding.id is null then
      insert into public.holdings (portfolio_id, symbol, quantity, cost_basis)
      values (portfolio.id, p_symbol, p_quantity, gross);
    else
      update public.holdings
      set quantity = quantity + p_quantity,
          cost_basis = cost_basis + gross
      where id = holding.id;
    end if;
  else
    if holding.id is null or holding.quantity < p_quantity then
      raise exception 'you do not own that many shares';
    end if;

    sold_cost := round(holding.cost_basis * (p_quantity / holding.quantity), 2);

    if cycle.direction = 'short' then
      proceeds := greatest(round(2 * sold_cost - gross, 2), 0);
    else
      proceeds := gross;
    end if;

    update public.portfolios
    set cash = cash + proceeds
    where id = portfolio.id;

    if holding.quantity = p_quantity then
      delete from public.holdings where id = holding.id;
    else
      update public.holdings
      set quantity = quantity - p_quantity,
          cost_basis = greatest(cost_basis - sold_cost, 0)
      where id = holding.id;
    end if;
  end if;

  insert into public.trades (portfolio_id, symbol, side, quantity, price, value)
  values (portfolio.id, p_symbol, p_side, p_quantity, p_price, gross)
  returning * into trade;

  return trade;
end;
$$;

-- The nine-argument version would otherwise stay callable beside the new one
-- and PostgREST would have two overloads to choose between. Dropped after the
-- new one exists, so fill_lineup's nine-argument call resolves to it with the
-- new flag taking its default.
drop function if exists public.execute_trade(uuid, uuid, text, text, numeric, numeric, integer, integer, date);

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

revoke all on function public.create_draft(uuid, uuid, text, text, text, date, date, numeric, text, numeric, integer, integer)
  from public, anon, authenticated;
revoke all on function public.join_draft(uuid, uuid, integer) from public, anon, authenticated;
revoke all on function public.leave_draft(uuid, uuid) from public, anon, authenticated;
revoke all on function public.start_draft(uuid, uuid, uuid[], uuid[], integer, integer, integer, timestamptz)
  from public, anon, authenticated;
revoke all on function public.make_pick(uuid, uuid, text, timestamptz) from public, anon, authenticated;
revoke all on function public.clock_pick(uuid, text, timestamptz) from public, anon, authenticated;
revoke all on function public.take_pick(public.drafts, public.draft_picks, text, boolean, timestamptz)
  from public, anon, authenticated;
revoke all on function public.cancel_draft(uuid, uuid) from public, anon, authenticated;
revoke all on function public.fill_draft(uuid, jsonb, numeric, date) from public, anon, authenticated;
revoke all on function public.execute_trade(uuid, uuid, text, text, numeric, numeric, integer, integer, date, boolean)
  from public, anon, authenticated;

grant execute on function public.create_draft(uuid, uuid, text, text, text, date, date, numeric, text, numeric, integer, integer) to service_role;
grant execute on function public.join_draft(uuid, uuid, integer) to service_role;
grant execute on function public.leave_draft(uuid, uuid) to service_role;
grant execute on function public.start_draft(uuid, uuid, uuid[], uuid[], integer, integer, integer, timestamptz) to service_role;
grant execute on function public.make_pick(uuid, uuid, text, timestamptz) to service_role;
grant execute on function public.clock_pick(uuid, text, timestamptz) to service_role;
grant execute on function public.cancel_draft(uuid, uuid) to service_role;
grant execute on function public.fill_draft(uuid, jsonb, numeric, date) to service_role;
grant execute on function public.execute_trade(uuid, uuid, text, text, numeric, numeric, integer, integer, date, boolean) to service_role;
