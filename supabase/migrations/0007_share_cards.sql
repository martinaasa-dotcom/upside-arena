-- Upside Arena, phase 6: the shareable weekly recap card.
--
-- Section 2.6 calls this the real growth engine, and it is right about why.
-- With no cash prize to talk about, the only thing anyone can post is the
-- result itself, so the card has to be worth posting after a bad week as well
-- as a good one. That single requirement decides almost everything below.
--
-- Two tables. One records what a portfolio was worth at each day's close,
-- which is what gives the card a shape rather than a single number. The other
-- is the card itself, and it is a snapshot rather than a live view.
--
-- The snapshot matters more than it looks. A share link is a public URL: it
-- ends up in a group chat and stays there. A card that queried live data
-- would keep exposing a player's current standing to everyone who ever saw
-- the link, and would quietly rewrite what they posted. Freezing it means a
-- shared card says exactly what it said when it was shared, for ever, and
-- reveals nothing that was not deliberately shared.

-- ---------------------------------------------------------------------------
-- portfolio_marks
-- ---------------------------------------------------------------------------
-- What a portfolio was worth at the end of each trading day.
--
-- Wordle travelled because the grid showed the shape of somebody's attempt,
-- not just whether they won. A week of five marks does the same job here, and
-- it cannot be reconstructed after the fact: prices move on, so a day not
-- recorded on the day is gone.

create table public.portfolio_marks (
  portfolio_id uuid not null references public.portfolios (id) on delete cascade,

  -- The New York trading date this mark belongs to.
  on_date date not null,

  value numeric(14, 2) not null,

  -- Return against the starting balance, in percent, at that close.
  return_percent numeric(10, 4) not null,

  recorded_at timestamptz not null default now(),

  primary key (portfolio_id, on_date),

  constraint portfolio_marks_value_not_negative check (value >= 0)
);

comment on table public.portfolio_marks is
  'End of day value per portfolio. Written once per trading day and never revised.';

-- ---------------------------------------------------------------------------
-- share_cards
-- ---------------------------------------------------------------------------

create table public.share_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  cycle_id uuid not null references public.weekly_cycles (id) on delete cascade,

  /*
    What the public URL contains. Long and random rather than sequential: a
    card is only as private as its link, so the link must not be guessable and
    must not reveal that other cards exist next to it.
  */
  token text not null unique,

  -- Everything the card shows, frozen at the moment it was made.
  display_name text not null,
  title_name text,

  return_percent numeric(10, 4) not null,
  benchmark_return numeric(10, 4),
  benchmark_diff numeric(10, 4),

  league_name text,
  league_rank integer,
  league_size integer,

  streak_days integer not null default 0,

  -- The daily marks, oldest first, as percentages. Empty when the week ran
  -- before marks were being recorded, and the card simply omits the shape.
  marks jsonb not null default '[]'::jsonb,

  monday date not null,

  created_at timestamptz not null default now(),

  /*
    Taking a card back. The row is kept rather than deleted so the link stays
    dead instead of being reissued to somebody else, and so the player can see
    that they revoked it.
  */
  revoked_at timestamptz,

  -- One card per player per week. Sharing the same week twice is the same
  -- card, not a second one.
  unique (user_id, cycle_id)
);

create index share_cards_user_idx on public.share_cards (user_id);

comment on table public.share_cards is
  'A frozen weekly result, readable by anyone holding its link. Never a live view of a player.';

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.portfolio_marks enable row level security;
alter table public.share_cards enable row level security;

create policy "a player reads the marks on their own portfolios"
  on public.portfolio_marks for select
  to authenticated
  using (
    exists (
      select 1 from public.portfolios
      where portfolios.id = portfolio_marks.portfolio_id
        and portfolios.user_id = auth.uid()
    )
  );

create policy "a player reads their own share cards"
  on public.share_cards for select
  to authenticated
  using (auth.uid() = user_id);

/*
  No policy for anon on share_cards, deliberately.

  The public page looks a card up by its token through the service role. If
  anon could read the table directly it could be listed, and a table of every
  player's weekly result is exactly the thing a per-link secret is meant to
  prevent.
*/

-- ---------------------------------------------------------------------------
-- record_portfolio_mark
-- ---------------------------------------------------------------------------
-- Idempotent within a day: the cron may run every hour and a day is recorded
-- once. A mark already taken is never overwritten, because the value at the
-- close is the value at the close, and a later run would replace it with a
-- number from a different moment.

create or replace function public.record_portfolio_mark(
  p_portfolio_id uuid,
  p_date date,
  p_value numeric,
  p_return_percent numeric
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted integer;
begin
  insert into public.portfolio_marks (portfolio_id, on_date, value, return_percent)
  values (p_portfolio_id, p_date, p_value, p_return_percent)
  on conflict (portfolio_id, on_date) do nothing;

  get diagnostics inserted = row_count;
  return inserted > 0;
end;
$$;

-- ---------------------------------------------------------------------------
-- generate_share_token
-- ---------------------------------------------------------------------------

create or replace function public.generate_share_token()
returns text
language plpgsql
volatile
set search_path = public
as $$
declare
  candidate text;
begin
  loop
    /*
      Thirty-two hex characters, from a random uuid. Not a readable code like
      a league invite: an invite is read aloud to a friend, while this is only
      ever copied, so it should be long enough that guessing is pointless.

      gen_random_uuid rather than gen_random_bytes on purpose. The second one
      comes from pgcrypto, which a hosted Postgres installs into a schema of
      its own, so a function pinned to search_path = public cannot see it. The
      first is core Postgres and is there wherever this runs.
    */
    candidate := replace(gen_random_uuid()::text, '-', '');

    exit when not exists (
      select 1 from public.share_cards where share_cards.token = candidate
    );
  end loop;

  return candidate;
end;
$$;

-- ---------------------------------------------------------------------------
-- create_share_card
-- ---------------------------------------------------------------------------
-- Freezes a week into something that can be posted.
--
-- Sharing the same week again returns the same card and the same link, so a
-- player who shares twice does not scatter two different URLs. The exception
-- is a card they revoked: that link is dead on purpose, so carrying on using
-- it would undo the revoking. That one gets a new token.

create or replace function public.create_share_card(
  p_user_id uuid,
  p_cycle_id uuid,
  p_monday date,
  p_display_name text,
  p_title_name text,
  p_return_percent numeric,
  p_benchmark_return numeric,
  p_benchmark_diff numeric,
  p_league_name text,
  p_league_rank integer,
  p_league_size integer,
  p_streak_days integer,
  p_marks jsonb
)
returns public.share_cards
language plpgsql
security definer
set search_path = public
as $$
declare
  card public.share_cards;
begin
  insert into public.share_cards (
    user_id, cycle_id, token, display_name, title_name,
    return_percent, benchmark_return, benchmark_diff,
    league_name, league_rank, league_size, streak_days, marks, monday
  )
  values (
    p_user_id, p_cycle_id, public.generate_share_token(), p_display_name, p_title_name,
    p_return_percent, p_benchmark_return, p_benchmark_diff,
    p_league_name, p_league_rank, p_league_size, coalesce(p_streak_days, 0),
    coalesce(p_marks, '[]'::jsonb), p_monday
  )
  on conflict (user_id, cycle_id) do update
  set display_name = excluded.display_name,
      title_name = excluded.title_name,
      return_percent = excluded.return_percent,
      benchmark_return = excluded.benchmark_return,
      benchmark_diff = excluded.benchmark_diff,
      league_name = excluded.league_name,
      league_rank = excluded.league_rank,
      league_size = excluded.league_size,
      streak_days = excluded.streak_days,
      marks = excluded.marks,
      -- A revoked link stays dead. Sharing again mints a new one.
      token = case
        when public.share_cards.revoked_at is null then public.share_cards.token
        else public.generate_share_token()
      end,
      revoked_at = null
  returning * into card;

  return card;
end;
$$;

-- ---------------------------------------------------------------------------
-- revoke_share_card
-- ---------------------------------------------------------------------------

create or replace function public.revoke_share_card(
  p_user_id uuid,
  p_card_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  affected integer;
begin
  -- Scoped to the owner. A card id is not a secret, so the owner check is
  -- what stops one player taking down another's.
  update public.share_cards
  set revoked_at = now()
  where id = p_card_id and user_id = p_user_id and revoked_at is null;

  get diagnostics affected = row_count;
  return affected > 0;
end;
$$;

-- ---------------------------------------------------------------------------
-- Only the service role writes any of this
-- ---------------------------------------------------------------------------

revoke all on function public.record_portfolio_mark(uuid, date, numeric, numeric) from public, anon, authenticated;
revoke all on function public.generate_share_token() from public, anon, authenticated;
revoke all on function public.create_share_card(uuid, uuid, date, text, text, numeric, numeric, numeric, text, integer, integer, integer, jsonb) from public, anon, authenticated;
revoke all on function public.revoke_share_card(uuid, uuid) from public, anon, authenticated;

grant execute on function public.record_portfolio_mark(uuid, date, numeric, numeric) to service_role;
grant execute on function public.create_share_card(uuid, uuid, date, text, text, numeric, numeric, numeric, text, integer, integer, integer, jsonb) to service_role;
grant execute on function public.revoke_share_card(uuid, uuid) to service_role;
