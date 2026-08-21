-- Tests for the earned randomness of section 3.1: that a milestone pays once,
-- pays the same amount however often it is asked, and cannot be re-rolled.

\set ON_ERROR_STOP on
\o /dev/null

insert into auth.users (id, email, raw_user_meta_data)
values
  ('aaaa1111-0000-0000-0000-000000000001', 'ada@example.com', '{}'::jsonb),
  ('bbbb2222-0000-0000-0000-000000000002', 'bob@example.com', '{}'::jsonb);

-- ---------------------------------------------------------------------------
-- The amount is decided by the player and the milestone, and nothing else
-- ---------------------------------------------------------------------------

select public.assert(
  public.streak_bonus_amount('aaaa1111-0000-0000-0000-000000000001', 5)
    = public.streak_bonus_amount('aaaa1111-0000-0000-0000-000000000001', 5),
  'the same milestone always pays the same player the same amount'
);

-- The whole point. If this could change between two calls, a player could
-- refresh the page until they liked the number, which is a slot machine.
do $$
declare
  first_answer integer;
  i integer;
begin
  first_answer := public.streak_bonus_amount('aaaa1111-0000-0000-0000-000000000001', 20);
  for i in 1..20 loop
    if public.streak_bonus_amount('aaaa1111-0000-0000-0000-000000000001', 20)
       <> first_answer then
      raise exception 'FAILED: a bonus could be re-rolled by asking again';
    end if;
  end loop;
  raise notice 'ok: a bonus cannot be re-rolled by asking again';
end;
$$;

select public.assert(
  public.streak_bonus_amount('aaaa1111-0000-0000-0000-000000000001', 5) > 0,
  'every milestone is worth something, so showing up always paid off'
);

select public.assert(
  public.streak_bonus_amount('aaaa1111-0000-0000-0000-000000000001', 40)
    > public.streak_bonus_amount('aaaa1111-0000-0000-0000-000000000001', 5) / 2,
  'a longer streak is worth more, not less'
);

-- ---------------------------------------------------------------------------
-- Paying the milestones
-- ---------------------------------------------------------------------------

select public.assert(
  (select count(*) from public.grant_streak_bonuses(
     'aaaa1111-0000-0000-0000-000000000001', 4)) = 0,
  'a streak short of the first milestone pays nothing'
);

select public.assert(
  (select count(*) from public.grant_streak_bonuses(
     'aaaa1111-0000-0000-0000-000000000001', 5)) = 1,
  'reaching the first milestone pays once'
);

select public.assert(
  (select balance from public.coin_balances
   where user_id = 'aaaa1111-0000-0000-0000-000000000001')
    = public.streak_bonus_amount('aaaa1111-0000-0000-0000-000000000001', 5),
  'and pays exactly what it said it would'
);

-- Called on every home screen render, so this is the case that matters most.
select public.assert(
  (select count(*) from public.grant_streak_bonuses(
     'aaaa1111-0000-0000-0000-000000000001', 5)) = 0,
  'asking again pays nothing, because a milestone pays once'
);

select public.assert(
  (select balance from public.coin_balances
   where user_id = 'aaaa1111-0000-0000-0000-000000000001')
    = public.streak_bonus_amount('aaaa1111-0000-0000-0000-000000000001', 5),
  'and the balance does not move'
);

-- ---------------------------------------------------------------------------
-- Catching up, when a streak passes several at once
-- ---------------------------------------------------------------------------

select public.assert(
  (select count(*) from public.grant_streak_bonuses(
     'bbbb2222-0000-0000-0000-000000000002', 20)) = 4,
  'a player arriving at twenty days is paid for all four milestones'
);

select public.assert(
  (select balance from public.coin_balances
   where user_id = 'bbbb2222-0000-0000-0000-000000000002')
    = public.streak_bonus_amount('bbbb2222-0000-0000-0000-000000000002', 5)
    + public.streak_bonus_amount('bbbb2222-0000-0000-0000-000000000002', 10)
    + public.streak_bonus_amount('bbbb2222-0000-0000-0000-000000000002', 15)
    + public.streak_bonus_amount('bbbb2222-0000-0000-0000-000000000002', 20),
  'and the total is the four amounts added up'
);

-- ---------------------------------------------------------------------------
-- The drop
-- ---------------------------------------------------------------------------

select public.assert(
  exists (select 1 from public.user_rewards
          where user_id = 'bbbb2222-0000-0000-0000-000000000002'),
  'the twenty day milestone hands over a cosmetic as well'
);

select public.assert(
  (select count(*) from public.user_rewards
   where user_id = 'bbbb2222-0000-0000-0000-000000000002') = 1,
  'one of them, not a handful'
);

select public.assert(
  (select plus_only from public.rewards r
   join public.user_rewards ur on ur.reward_id = r.id
   where ur.user_id = 'bbbb2222-0000-0000-0000-000000000002') = false,
  'never a members-only item, which nobody could have earned another way'
);

select public.assert(
  (select coin_price from public.rewards r
   join public.user_rewards ur on ur.reward_id = r.id
   where ur.user_id = 'bbbb2222-0000-0000-0000-000000000002') is not null,
  'and always something that could have been bought with coins instead'
);

-- ---------------------------------------------------------------------------
-- Breaking a streak on purpose earns nothing
-- ---------------------------------------------------------------------------

do $$
declare
  balance_before integer;
begin
  select balance into balance_before from public.coin_balances
  where user_id = 'aaaa1111-0000-0000-0000-000000000001';

  -- Back to nothing, then all the way up again.
  perform public.grant_streak_bonuses('aaaa1111-0000-0000-0000-000000000001', 0);
  perform public.grant_streak_bonuses('aaaa1111-0000-0000-0000-000000000001', 5);

  if (select balance from public.coin_balances
      where user_id = 'aaaa1111-0000-0000-0000-000000000001') <> balance_before then
    raise exception 'FAILED: a milestone paid twice after a broken streak';
  end if;

  raise notice 'ok: breaking a streak and reaching a milestone again pays nothing';
end;
$$;

-- ---------------------------------------------------------------------------
-- Nothing here is a player's to call
-- ---------------------------------------------------------------------------

do $$
begin
  perform set_config('request.jwt.claims',
    '{"sub": "aaaa1111-0000-0000-0000-000000000001"}', true);
  set local role authenticated;

  begin
    perform public.grant_streak_bonuses('aaaa1111-0000-0000-0000-000000000001', 100);
    raise exception 'FAILED: a player paid themselves a streak bonus';
  exception when insufficient_privilege then
    raise notice 'ok: a player cannot pay themselves a streak bonus';
  end;

  begin
    perform public.streak_bonus_amount('aaaa1111-0000-0000-0000-000000000001', 5);
    raise exception 'FAILED: a player read the bonus table directly';
  exception when insufficient_privilege then
    raise notice 'ok: a player cannot look up what a milestone will pay';
  end;
end $$;
