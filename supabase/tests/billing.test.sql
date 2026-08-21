-- Tests for paying for things.
--
-- Two rules from section 9 are what most of this is defending. Money never
-- touches competitive scoring, and everything bought is bought directly. The
-- rest is about the two ways a payment system loses somebody's money: a
-- webhook delivered twice, and a purchase that takes the balance without
-- handing over the item.

\set ON_ERROR_STOP on
\o /dev/null

insert into auth.users (id, email) values
  ('aaaa1111-0000-0000-0000-000000000001', 'nina@example.com'),
  ('bbbb2222-0000-0000-0000-000000000002', 'omar@example.com');

-- ---------------------------------------------------------------------------
-- Entitlements
-- ---------------------------------------------------------------------------

select public.assert(
  public.has_entitlement('aaaa1111-0000-0000-0000-000000000001', 'plus') = false,
  'nobody starts with anything they have not paid for'
);

select public.grant_entitlement(
  'aaaa1111-0000-0000-0000-000000000001', 'plus', 'stripe', 'active',
  'sub_123', now() + interval '30 days');

select public.assert(
  public.has_entitlement('aaaa1111-0000-0000-0000-000000000001', 'plus'),
  'a paid subscription is active'
);

select public.assert(
  public.has_entitlement('bbbb2222-0000-0000-0000-000000000002', 'plus') = false,
  'and belongs to one person only'
);

/*
  Cancelled but paid up until the end of the month. They paid for it, so they
  keep it until it runs out. Cutting somebody off the moment they cancel is
  how a click-to-cancel flow turns into a complaint.
*/
select public.grant_entitlement(
  'aaaa1111-0000-0000-0000-000000000001', 'plus', 'stripe', 'cancelled',
  'sub_123', now() + interval '10 days');

select public.assert(
  public.has_entitlement('aaaa1111-0000-0000-0000-000000000001', 'plus'),
  'cancelling keeps what has been paid for until it runs out'
);

select public.grant_entitlement(
  'aaaa1111-0000-0000-0000-000000000001', 'plus', 'stripe', 'cancelled',
  'sub_123', now() - interval '1 day');

select public.assert(
  public.has_entitlement('aaaa1111-0000-0000-0000-000000000001', 'plus') = false,
  'and stops when it does'
);

select public.assert(
  (select count(*) from public.entitlements
   where user_id = 'aaaa1111-0000-0000-0000-000000000001') = 1,
  'a subscription changing state is one row, not a pile of them'
);

/*
  Keyed by person and product, never by a provider's subscription id. The day
  an app store is involved, another provider has to be another value in a
  column rather than another schema.
*/
select public.grant_entitlement(
  'bbbb2222-0000-0000-0000-000000000002', 'plus', 'apple', 'active', 'txn_9', null);

select public.assert(
  public.has_entitlement('bbbb2222-0000-0000-0000-000000000002', 'plus'),
  'a different payment provider grants the same entitlement'
);

-- ---------------------------------------------------------------------------
-- Coins
-- ---------------------------------------------------------------------------

select public.assert(
  public.add_coins('aaaa1111-0000-0000-0000-000000000001', 500, 'purchase', 'cs_test_1') = 500,
  'buying coins credits them'
);

select public.assert(
  public.add_coins('aaaa1111-0000-0000-0000-000000000001', 500, 'purchase', 'cs_test_1') = 500,
  'the same completed checkout delivered twice credits them once'
);

select public.assert(
  (select count(*) from public.coin_ledger
   where user_id = 'aaaa1111-0000-0000-0000-000000000001') = 1,
  'and leaves one line in the ledger, not two'
);

select public.assert(
  public.add_coins('aaaa1111-0000-0000-0000-000000000001', 250, 'purchase', 'cs_test_2') = 750,
  'a genuinely different purchase is credited'
);

do $$
begin
  begin
    perform public.add_coins('aaaa1111-0000-0000-0000-000000000001', -100, 'purchase', 'cs_bad');
    raise exception 'FAILED: a negative purchase was credited';
  exception when others then
    if sqlerrm like 'FAILED:%' then raise; end if;
    raise notice 'ok: coins cannot be added by a negative amount';
  end;
end $$;

-- ---------------------------------------------------------------------------
-- Buying a cosmetic
-- ---------------------------------------------------------------------------

select public.assert(
  public.buy_reward('aaaa1111-0000-0000-0000-000000000001', 'title.the_quiet_one') = 500,
  'buying a title takes its price and nothing more'
);

select public.assert(
  (select count(*) from public.user_rewards
   where user_id = 'aaaa1111-0000-0000-0000-000000000001'
     and reward_id = 'title.the_quiet_one') = 1,
  'and hands the title over in the same breath'
);

select public.assert(
  (select balance_after from public.coin_ledger
   where reason = 'spend' and user_id = 'aaaa1111-0000-0000-0000-000000000001') = 500,
  'the ledger records what the balance became'
);

do $$
begin
  begin
    perform public.buy_reward('aaaa1111-0000-0000-0000-000000000001', 'title.the_quiet_one');
    raise exception 'FAILED: a title was sold twice';
  exception when others then
    if sqlerrm like 'FAILED:%' then raise; end if;
    raise notice 'ok: a title already owned cannot be bought again';
  end;
end $$;

select public.assert(
  (select balance from public.coin_balances
   where user_id = 'aaaa1111-0000-0000-0000-000000000001') = 500,
  'and the refused purchase took nothing'
);

do $$
begin
  begin
    -- A title earned by showing up is not for sale at any price.
    perform public.buy_reward('aaaa1111-0000-0000-0000-000000000001', 'title.a_month');
    raise exception 'FAILED: an earned title was bought';
  exception when others then
    if sqlerrm like 'FAILED:%' then raise; end if;
    raise notice 'ok: a title that has to be earned cannot be bought';
  end;

  begin
    perform public.buy_reward('bbbb2222-0000-0000-0000-000000000002', 'title.the_quiet_one');
    raise exception 'FAILED: somebody bought with no coins';
  exception when others then
    if sqlerrm like 'FAILED:%' then raise; end if;
    raise notice 'ok: a purchase with no balance is refused';
  end;
end $$;

select public.assert(
  (select count(*) from public.user_rewards
   where user_id = 'bbbb2222-0000-0000-0000-000000000002') = 0,
  'and hands over nothing'
);

-- A subscriber-only title is not on sale for coins, to anybody.
do $$
begin
  begin
    perform public.buy_reward('aaaa1111-0000-0000-0000-000000000001', 'title.house_style');
    raise exception 'FAILED: a subscriber only title was bought with coins';
  exception when others then
    if sqlerrm like 'FAILED:%' then raise; end if;
    raise notice 'ok: a subscriber only title cannot be bought with coins';
  end;
end $$;

-- ---------------------------------------------------------------------------
-- Nothing bought can touch a score
-- ---------------------------------------------------------------------------
-- The whole locked model rests on this. It is asserted rather than assumed,
-- because it is the one thing that cannot be walked back after launch.

select public.ensure_cycle('2026-08-17', 100000, 500);
select public.ensure_portfolio('aaaa1111-0000-0000-0000-000000000001',
  (select id from public.weekly_cycles where monday = '2026-08-17'));

create temporary table before_buying as
  select cash, starting_balance from public.portfolios
  where user_id = 'aaaa1111-0000-0000-0000-000000000001';

select public.add_coins('aaaa1111-0000-0000-0000-000000000001', 10000, 'purchase', 'cs_big');
select public.buy_reward('aaaa1111-0000-0000-0000-000000000001', 'title.long_game');

select public.assert(
  (select cash from public.portfolios
   where user_id = 'aaaa1111-0000-0000-0000-000000000001')
  = (select cash from before_buying),
  'spending real money leaves the play money exactly where it was'
);

select public.assert(
  (select starting_balance from public.portfolios
   where user_id = 'aaaa1111-0000-0000-0000-000000000001')
  = (select starting_balance from before_buying),
  'and everyone still starts the week with the same amount'
);

select public.assert(
  (select count(*) from public.rewards where coin_price is not null and streak_required is not null) = 0,
  'nothing is both earned and for sale, so paying can never skip a milestone'
);

-- ---------------------------------------------------------------------------
-- What the subscription actually changes
-- ---------------------------------------------------------------------------
-- The only mechanical difference money makes, and it has to stay on the
-- convenience side of the line: a freeze covers a day somebody did not open
-- the app, and a streak has never touched a standing or a lifetime figure.

select public.record_activity(
  'bbbb2222-0000-0000-0000-000000000002', '2026-08-17', 0, '2026-08-17', 1);

select public.assert(
  (select freezes_available from public.streaks
   where user_id = 'bbbb2222-0000-0000-0000-000000000002') = 1,
  'the free tier is granted one freeze a week'
);

-- The same player, the following week, now subscribed.
select public.record_activity(
  'bbbb2222-0000-0000-0000-000000000002', '2026-08-24', 0, '2026-08-24', 3);

select public.assert(
  (select freezes_available from public.streaks
   where user_id = 'bbbb2222-0000-0000-0000-000000000002') = 3,
  'a subscriber is granted three'
);

select public.assert(
  (select current_streak from public.streaks
   where user_id = 'bbbb2222-0000-0000-0000-000000000002') = 2,
  'and the streak counts exactly as it did before, because money does not score'
);

/*
  Lapsing must not take away a freeze already granted. The grant lifts the
  count rather than setting it, so a week that grants one to somebody holding
  three leaves three.
*/
select public.record_activity(
  'bbbb2222-0000-0000-0000-000000000002', '2026-08-31', 0, '2026-08-31', 1);

select public.assert(
  (select freezes_available from public.streaks
   where user_id = 'bbbb2222-0000-0000-0000-000000000002') = 3,
  'letting a subscription lapse never takes back a freeze already granted'
);

-- ---------------------------------------------------------------------------
-- Webhooks delivered more than once
-- ---------------------------------------------------------------------------

select public.assert(
  public.claim_billing_event('evt_1', 'checkout.session.completed') = true,
  'a webhook not seen before is claimed'
);

select public.assert(
  public.claim_billing_event('evt_1', 'checkout.session.completed') = false,
  'and the same one redelivered is refused, so a retry is never a replay'
);

-- ---------------------------------------------------------------------------
-- The handoff
-- ---------------------------------------------------------------------------

select public.record_handoff_shown('aaaa1111-0000-0000-0000-000000000001');

select public.assert(
  (select shown_count from public.lab_handoffs
   where user_id = 'aaaa1111-0000-0000-0000-000000000001') = 1,
  'offering the handoff is counted, so it can be offered rarely'
);

select public.assert(
  (select length(token) from public.lab_handoffs
   where user_id = 'aaaa1111-0000-0000-0000-000000000001') = 32,
  'and carries an opaque token rather than anything about the person'
);

create temporary table first_handoff_token as
  select token from public.lab_handoffs
  where user_id = 'aaaa1111-0000-0000-0000-000000000001';

select public.record_handoff_shown('aaaa1111-0000-0000-0000-000000000001');

select public.assert(
  (select shown_count from public.lab_handoffs
   where user_id = 'aaaa1111-0000-0000-0000-000000000001') = 2,
  'showing it again counts again'
);

select public.assert(
  (select token from public.lab_handoffs
   where user_id = 'aaaa1111-0000-0000-0000-000000000001')
  = (select token from first_handoff_token),
  'but the token stays the same, so a click is attributable however long it takes'
);

select public.record_handoff_outcome('aaaa1111-0000-0000-0000-000000000001', 'dismissed');

select public.assert(
  (select dismissed_at is not null from public.lab_handoffs
   where user_id = 'aaaa1111-0000-0000-0000-000000000001'),
  'saying no is recorded, so it can be respected'
);

-- ---------------------------------------------------------------------------
-- Nobody but the service role writes any of it
-- ---------------------------------------------------------------------------

do $$
begin
  begin
    perform set_config('request.jwt.claims',
      '{"sub": "bbbb2222-0000-0000-0000-000000000002"}', true);
    perform set_config('role', 'authenticated', true);
    insert into public.entitlements (user_id, product, source)
    values ('bbbb2222-0000-0000-0000-000000000002', 'plus', 'gift');
    raise exception 'FAILED: a player granted themselves a subscription';
  exception when insufficient_privilege then
    raise notice 'ok: a player cannot grant themselves an entitlement';
  end;

  begin
    perform set_config('request.jwt.claims',
      '{"sub": "bbbb2222-0000-0000-0000-000000000002"}', true);
    perform set_config('role', 'authenticated', true);
    insert into public.coin_balances (user_id, balance)
    values ('bbbb2222-0000-0000-0000-000000000002', 999999);
    raise exception 'FAILED: a player set their own balance';
  exception when insufficient_privilege then
    raise notice 'ok: a player cannot set their own coin balance';
  end;

  begin
    perform set_config('request.jwt.claims',
      '{"sub": "bbbb2222-0000-0000-0000-000000000002"}', true);
    perform set_config('role', 'authenticated', true);
    perform public.add_coins('bbbb2222-0000-0000-0000-000000000002', 5000, 'gift', 'free_money');
    raise exception 'FAILED: a player minted coins';
  exception when insufficient_privilege then
    raise notice 'ok: a player cannot call the coin function directly';
  end;

  begin
    perform set_config('request.jwt.claims',
      '{"sub": "bbbb2222-0000-0000-0000-000000000002"}', true);
    perform set_config('role', 'authenticated', true);
    perform public.buy_reward('bbbb2222-0000-0000-0000-000000000002', 'title.the_quiet_one');
    raise exception 'FAILED: a player called the purchase function directly';
  exception when insufficient_privilege then
    raise notice 'ok: a player cannot call the purchase function directly';
  end;

  begin
    perform set_config('request.jwt.claims',
      '{"sub": "bbbb2222-0000-0000-0000-000000000002"}', true);
    perform set_config('role', 'authenticated', true);
    perform public.claim_billing_event('evt_forged', 'anything');
    raise exception 'FAILED: a player claimed a billing event';
  exception when insufficient_privilege then
    raise notice 'ok: a player cannot claim a billing event';
  end;
end $$;

begin;
  set local request.jwt.claims = '{"sub": "bbbb2222-0000-0000-0000-000000000002"}';
  set local role authenticated;

  select public.assert(
    (select count(*) from public.entitlements) = 1,
    'a player reads their own entitlements and nobody else''s'
  );

  select public.assert(
    (select count(*) from public.coin_ledger) = 0,
    'and cannot see anybody else''s spending'
  );

  select public.assert(
    (select count(*) from public.billing_customers) = 0,
    'and never sees a payment provider''s customer identifiers'
  );
commit;

-- ---------------------------------------------------------------------------
-- Closing an account
-- ---------------------------------------------------------------------------

delete from auth.users where id = 'aaaa1111-0000-0000-0000-000000000001';

select public.assert(
  (select count(*) from public.entitlements
   where user_id = 'aaaa1111-0000-0000-0000-000000000001') = 0
  and (select count(*) from public.coin_ledger
   where user_id = 'aaaa1111-0000-0000-0000-000000000001') = 0
  and (select count(*) from public.lab_handoffs
   where user_id = 'aaaa1111-0000-0000-0000-000000000001') = 0,
  'closing an account takes its entitlements, its coins and its handoff with it'
);
