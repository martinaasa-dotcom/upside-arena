-- Tests for the rest of the cosmetics: three slots, and the rule that nothing
-- worn can be anything other than something owned that fits.
--
-- The interesting failures here are not visual. They are a player wearing
-- something they never got, and a bought item being made to look earned.

\set ON_ERROR_STOP on
\o /dev/null

insert into auth.users (id, email) values
  ('aaaa1111-0000-0000-0000-000000000001', 'nina@example.com'),
  ('bbbb2222-0000-0000-0000-000000000002', 'omar@example.com');

-- ---------------------------------------------------------------------------
-- The catalogue itself
-- ---------------------------------------------------------------------------

select public.assert(
  (select count(distinct kind) from public.rewards) = 3,
  'the catalogue carries titles, rings and themes'
);

select public.assert(
  (select count(*) from public.rewards
   where kind <> 'title' and style_key is null) = 0,
  'everything that gets drawn says what to draw'
);

/*
  Nothing is both earned and for sale. If it were, paying would be a way to
  skip a milestone somebody else had to show up for, which is the whole line
  section 9 draws.
*/
select public.assert(
  (select count(*) from public.rewards
   where coin_price is not null and streak_required is not null) = 0,
  'nothing can be both earned and bought'
);

select public.assert(
  (select count(*) from public.rewards where plus_only and coin_price is not null) = 0,
  'a members-only item is never also on sale for coins'
);

/*
  The shop has to be worth more than the largest bundle. Otherwise somebody
  buys the biggest one and is left holding currency with nothing to spend it
  on, which is the exact mistake this migration exists to correct.
*/
select public.assert(
  (select coalesce(sum(coin_price), 0) from public.rewards where coin_price is not null) > 3000,
  'the shop is worth more than the largest coin bundle'
);

-- ---------------------------------------------------------------------------
-- Wearing things
-- ---------------------------------------------------------------------------

select public.grant_reward('aaaa1111-0000-0000-0000-000000000001', 'title.regular');
select public.grant_reward('aaaa1111-0000-0000-0000-000000000001', 'flair.gold');
select public.grant_reward('aaaa1111-0000-0000-0000-000000000001', 'theme.quiet');

select public.equip_cosmetic('aaaa1111-0000-0000-0000-000000000001', 'title.regular', 'title');
select public.equip_cosmetic('aaaa1111-0000-0000-0000-000000000001', 'flair.gold', 'flair');
select public.equip_cosmetic('aaaa1111-0000-0000-0000-000000000001', 'theme.quiet', 'theme');

select public.assert(
  (select equipped_title = 'title.regular'
      and equipped_flair = 'flair.gold'
      and equipped_theme = 'theme.quiet'
   from public.profiles where id = 'aaaa1111-0000-0000-0000-000000000001'),
  'the three slots are worn at once, because they are not alternatives'
);

select public.equip_cosmetic('aaaa1111-0000-0000-0000-000000000001', null, 'flair');

select public.assert(
  (select equipped_flair is null and equipped_title = 'title.regular'
   from public.profiles where id = 'aaaa1111-0000-0000-0000-000000000001'),
  'taking one off leaves the others alone'
);

-- ---------------------------------------------------------------------------
-- What cannot be worn
-- ---------------------------------------------------------------------------

do $$
begin
  begin
    perform public.equip_cosmetic(
      'aaaa1111-0000-0000-0000-000000000001', 'flair.aqua', 'flair');
    raise exception 'FAILED: an unowned ring was worn';
  exception when others then
    if sqlerrm like 'FAILED:%' then raise; end if;
    raise notice 'ok: something never obtained cannot be worn';
  end;

  begin
    -- A title is not a picture frame.
    perform public.equip_cosmetic(
      'aaaa1111-0000-0000-0000-000000000001', 'title.regular', 'flair');
    raise exception 'FAILED: a title was worn as a ring';
  exception when others then
    if sqlerrm like 'FAILED:%' then raise; end if;
    raise notice 'ok: an item cannot be worn in the wrong slot';
  end;

  begin
    perform public.equip_cosmetic(
      'aaaa1111-0000-0000-0000-000000000001', 'title.regular', 'hat');
    raise exception 'FAILED: an invented slot was accepted';
  exception when others then
    if sqlerrm like 'FAILED:%' then raise; end if;
    raise notice 'ok: a slot that does not exist is refused';
  end;
end $$;

-- ---------------------------------------------------------------------------
-- Writing straight to the profile
-- ---------------------------------------------------------------------------
-- Row level security decides which rows are writable, not which values are
-- allowed in them. Without the trigger, a player could wear anything by
-- updating their own row.

do $$
begin
  begin
    perform set_config('request.jwt.claims',
      '{"sub": "bbbb2222-0000-0000-0000-000000000002"}', true);
    perform set_config('role', 'authenticated', true);
    update public.profiles set equipped_flair = 'flair.member'
      where id = 'bbbb2222-0000-0000-0000-000000000002';
    raise exception 'FAILED: a player wore an unowned ring by writing to their profile';
  exception when others then
    if sqlerrm like 'FAILED:%' then raise; end if;
    raise notice 'ok: a player cannot wear an unowned ring by writing to their profile';
  end;

  begin
    perform set_config('request.jwt.claims',
      '{"sub": "bbbb2222-0000-0000-0000-000000000002"}', true);
    perform set_config('role', 'authenticated', true);
    update public.profiles set equipped_theme = 'theme.house'
      where id = 'bbbb2222-0000-0000-0000-000000000002';
    raise exception 'FAILED: a player wore a members-only theme without a membership';
  exception when others then
    if sqlerrm like 'FAILED:%' then raise; end if;
    raise notice 'ok: a members-only theme cannot be taken by writing to the profile';
  end;

  begin
    perform set_config('request.jwt.claims',
      '{"sub": "bbbb2222-0000-0000-0000-000000000002"}', true);
    perform set_config('role', 'authenticated', true);
    perform public.equip_cosmetic(
      'bbbb2222-0000-0000-0000-000000000002', null, 'title');
    raise exception 'FAILED: a player called equip directly';
  exception when insufficient_privilege then
    raise notice 'ok: a player cannot call the equip function directly';
  end;
end $$;

-- ---------------------------------------------------------------------------
-- Buying one
-- ---------------------------------------------------------------------------

select public.add_coins('bbbb2222-0000-0000-0000-000000000002', 1000, 'gift', 'test_grant');

select public.assert(
  public.buy_reward('bbbb2222-0000-0000-0000-000000000002', 'flair.aqua') = 650,
  'a ring is bought like anything else'
);

select public.equip_cosmetic('bbbb2222-0000-0000-0000-000000000002', 'flair.aqua', 'flair');

select public.assert(
  (select equipped_flair = 'flair.aqua' from public.profiles
   where id = 'bbbb2222-0000-0000-0000-000000000002'),
  'and can be worn once bought'
);

do $$
begin
  begin
    perform public.buy_reward('bbbb2222-0000-0000-0000-000000000002', 'flair.member');
    raise exception 'FAILED: a members-only ring was bought with coins';
  exception when others then
    if sqlerrm like 'FAILED:%' then raise; end if;
    raise notice 'ok: a members-only ring is not for sale at any price';
  end;

  begin
    perform public.buy_reward('bbbb2222-0000-0000-0000-000000000002', 'flair.first_week');
    raise exception 'FAILED: an earned ring was bought';
  exception when others then
    if sqlerrm like 'FAILED:%' then raise; end if;
    raise notice 'ok: a ring that has to be earned cannot be bought';
  end;
end $$;

-- ---------------------------------------------------------------------------
-- None of it touches a score
-- ---------------------------------------------------------------------------

select public.ensure_cycle('2026-08-17', 100000, 500);
select public.ensure_portfolio('bbbb2222-0000-0000-0000-000000000002',
  (select id from public.weekly_cycles where monday = '2026-08-17'));

create temporary table before_dressing as
  select cash, starting_balance from public.portfolios
  where user_id = 'bbbb2222-0000-0000-0000-000000000002';

select public.buy_reward('bbbb2222-0000-0000-0000-000000000002', 'title.regular');
select public.equip_cosmetic('bbbb2222-0000-0000-0000-000000000002', 'title.regular', 'title');

select public.assert(
  (select cash from public.portfolios
   where user_id = 'bbbb2222-0000-0000-0000-000000000002')
  = (select cash from before_dressing)
  and (select starting_balance from public.portfolios
   where user_id = 'bbbb2222-0000-0000-0000-000000000002')
  = (select starting_balance from before_dressing),
  'buying and wearing cosmetics leaves the play money exactly where it was'
);
