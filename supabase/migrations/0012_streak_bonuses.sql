-- Upside Arena, section 3.1: variable rewards, earned only.
--
-- Unpredictable reward timing is the strongest retention lever there is, and
-- it is also the one closest to the line. Section 3 draws that line in one
-- place: the moment a randomised reward can be bought with real money it is a
-- loot box, which is banned outright in some countries and is the most
-- criticised pattern in consumer software.
--
-- So everything below is earned by turning up and cannot be bought at any
-- price. What varies is how much a milestone pays, never whether showing up
-- was worth anything.
--
-- Two rules make this honest rather than a slot machine:
--
--   1. The outcome is decided by the player and the milestone, not by when
--      the function ran. Refreshing the page cannot roll again for a better
--      one, because there is only ever one answer to roll.
--   2. Every milestone pays exactly once, ever. Breaking a streak on purpose
--      to farm the same milestone twice earns nothing.

-- How often a bonus falls, counted in trading days: roughly one a week.
-- Written into the function rather than a table because it is a product
-- decision, not a setting.

-- ---------------------------------------------------------------------------
-- streak_bonus_amount
-- ---------------------------------------------------------------------------
-- What a given milestone pays this particular player.
--
-- Pure, and derived from a hash of the two things it is for. The same player
-- asking about the same milestone gets the same answer for ever, which is
-- what stops the reward being a thing you can re-roll.

create or replace function public.streak_bonus_amount(
  p_user_id uuid,
  p_day integer
)
returns integer
language sql
immutable
as $$
  select (array[25, 40, 60, 80, 120])[
           (abs(hashtext(p_user_id::text || ':streak:' || p_day::text)) % 5) + 1
         ]
         -- Grows slowly with the streak, so a month in is worth more than a
         -- week in without ever becoming the reason somebody is here.
         * (1 + p_day / 20)
$$;

comment on function public.streak_bonus_amount(uuid, integer) is
  'Deterministic. The same milestone always pays the same player the same amount, so it cannot be re-rolled.';

-- ---------------------------------------------------------------------------
-- grant_streak_bonuses
-- ---------------------------------------------------------------------------
-- Pays every milestone a player has reached and not yet been paid for, and at
-- the longer ones hands over a cosmetic they do not own.
--
-- Returns one row per thing granted, so the app can say what happened without
-- asking a second question.

create or replace function public.grant_streak_bonuses(
  p_user_id uuid,
  p_streak integer,
  p_every integer default 5,
  p_drop_every integer default 20
)
returns table (day integer, coins integer, reward text)
language plpgsql
security definer
set search_path = public
as $$
declare
  milestone integer;
  amount integer;
  key text;
  dropped text;
begin
  if p_streak is null or p_streak < p_every then
    return;
  end if;

  milestone := p_every;

  while milestone <= p_streak loop
    key := 'streak:' || milestone::text;
    amount := public.streak_bonus_amount(p_user_id, milestone);
    dropped := null;

    /*
      A drop, at the longer milestones only. Chosen from what can be bought
      with coins and is not a members-only item, so a drop is always something
      the player could have got another way: a surprise is a shortcut here,
      never the only route to something.

      Ordered by a hash of the player, the milestone and the item, which makes
      the choice unpredictable to a person and fixed for ever to the database.
    */
    if milestone % p_drop_every = 0 then
      select r.id into dropped
      from public.rewards r
      where r.coin_price is not null
        and r.plus_only = false
        and not exists (
          select 1 from public.user_rewards ur
          where ur.user_id = p_user_id and ur.reward_id = r.id
        )
      order by hashtext(p_user_id::text || ':' || key || ':' || r.id)
      limit 1;

      if dropped is not null then
        insert into public.user_rewards (user_id, reward_id)
        values (p_user_id, dropped)
        on conflict (user_id, reward_id) do nothing;

        -- Already owned it by the time we got here. Nothing was granted, so
        -- nothing is reported.
        if not found then
          dropped := null;
        end if;
      end if;
    end if;

    /*
      The coins. add_coins refuses a second credit under the same key, so this
      is what makes the whole milestone pay once: on every later visit the
      insert is declined and nothing is reported.
    */
    if not exists (
      select 1 from public.coin_ledger where idempotency_key = key || ':' || p_user_id::text
    ) then
      perform public.add_coins(
        p_user_id, amount, 'gift', key || ':' || p_user_id::text, key
      );

      day := milestone;
      coins := amount;
      reward := dropped;
      return next;
    elsif dropped is not null then
      -- The coins were already paid but the drop is new, which happens when a
      -- player owned everything the first time round and has since spent.
      day := milestone;
      coins := 0;
      reward := dropped;
      return next;
    end if;

    milestone := milestone + p_every;
  end loop;
end;
$$;

revoke all on function public.streak_bonus_amount(uuid, integer)
  from public, anon, authenticated;
revoke all on function public.grant_streak_bonuses(uuid, integer, integer, integer)
  from public, anon, authenticated;

grant execute on function public.streak_bonus_amount(uuid, integer) to service_role;
grant execute on function public.grant_streak_bonuses(uuid, integer, integer, integer)
  to service_role;
