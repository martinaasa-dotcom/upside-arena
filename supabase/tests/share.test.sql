-- Tests for the share card: the daily marks behind it, the snapshot it
-- freezes, who may read it, and what revoking a link actually does.

\set ON_ERROR_STOP on
\o /dev/null

insert into auth.users (id, email) values
  ('aaaa1111-0000-0000-0000-000000000001', 'nina@example.com'),
  ('bbbb2222-0000-0000-0000-000000000002', 'omar@example.com');

select public.ensure_cycle('2026-08-17', 100000, 500);
select public.ensure_cycle('2026-08-24', 100000, 510);

select public.ensure_portfolio(
  'aaaa1111-0000-0000-0000-000000000001',
  (select id from public.weekly_cycles where monday = '2026-08-17'));
select public.ensure_portfolio(
  'bbbb2222-0000-0000-0000-000000000002',
  (select id from public.weekly_cycles where monday = '2026-08-17'));

-- ---------------------------------------------------------------------------
-- Daily marks
-- ---------------------------------------------------------------------------

select public.assert(
  public.record_portfolio_mark(
    (select id from public.portfolios
     where user_id = 'aaaa1111-0000-0000-0000-000000000001'),
    '2026-08-17', 101000, 1.0) = true,
  'a day not yet recorded is recorded'
);

select public.assert(
  public.record_portfolio_mark(
    (select id from public.portfolios
     where user_id = 'aaaa1111-0000-0000-0000-000000000001'),
    '2026-08-17', 999999, 900.0) = false,
  'the same day is never recorded twice, however often the job runs'
);

select public.assert(
  (select value from public.portfolio_marks
   where on_date = '2026-08-17'
     and portfolio_id = (select id from public.portfolios
                         where user_id = 'aaaa1111-0000-0000-0000-000000000001')) = 101000,
  'a mark already taken is left alone, because the close was the close'
);

select public.record_portfolio_mark(
  (select id from public.portfolios
   where user_id = 'aaaa1111-0000-0000-0000-000000000001'),
  '2026-08-18', 102500, 2.5);
select public.record_portfolio_mark(
  (select id from public.portfolios
   where user_id = 'aaaa1111-0000-0000-0000-000000000001'),
  '2026-08-19', 99000, -1.0);

select public.assert(
  (select count(*) from public.portfolio_marks) = 3,
  'each trading day gets its own mark'
);

-- ---------------------------------------------------------------------------
-- Making a card
-- ---------------------------------------------------------------------------

select public.create_share_card(
  'aaaa1111-0000-0000-0000-000000000001',
  (select id from public.weekly_cycles where monday = '2026-08-17'),
  '2026-08-17', 'Nina', 'A full week',
  4.2, 1.1, 3.1, 'Friday Club', 2, 6, 8,
  '[1.0, 2.5, -1.0, 3.4, 4.2]'::jsonb
);

select public.assert(
  (select count(*) from public.share_cards) = 1,
  'sharing a week makes a card'
);

select public.assert(
  (select length(token) >= 20 from public.share_cards) ,
  'the token is long enough that guessing a stranger''s card is pointless'
);

select public.assert(
  (select token ~ '^[0-9a-f]{32}$' from public.share_cards),
  'the token is safe to put in a URL without escaping'
);

/*
  Built from gen_random_uuid rather than pgcrypto's gen_random_bytes. A hosted
  Postgres puts pgcrypto in a schema of its own, which a function pinned to
  search_path = public cannot see, so this passed locally and failed live once
  already.
*/
select public.assert(
  (select count(distinct token) from public.share_cards) =
  (select count(*) from public.share_cards),
  'every card gets its own token'
);

select public.assert(
  (select jsonb_array_length(marks) = 5 from public.share_cards),
  'the shape of the week is frozen with it'
);

-- ---------------------------------------------------------------------------
-- The card is a snapshot, not a live view
-- ---------------------------------------------------------------------------

create temporary table first_token as
  select token from public.share_cards
  where user_id = 'aaaa1111-0000-0000-0000-000000000001';

-- The week carries on being played. A posted card must not follow along.
update public.portfolios
set cash = 1
where user_id = 'aaaa1111-0000-0000-0000-000000000001';

select public.assert(
  (select return_percent from public.share_cards
   where user_id = 'aaaa1111-0000-0000-0000-000000000001') = 4.2,
  'a card already posted keeps saying what it said, whatever happens next'
);

-- ---------------------------------------------------------------------------
-- Sharing the same week twice
-- ---------------------------------------------------------------------------

select public.create_share_card(
  'aaaa1111-0000-0000-0000-000000000001',
  (select id from public.weekly_cycles where monday = '2026-08-17'),
  '2026-08-17', 'Nina renamed', null,
  4.2, 1.1, 3.1, 'Friday Club', 2, 6, 9,
  '[1.0, 2.5, -1.0, 3.4, 4.2]'::jsonb
);

select public.assert(
  (select count(*) from public.share_cards) = 1,
  'sharing the same week again is the same card, not a second one'
);

select public.assert(
  (select token from public.share_cards
   where user_id = 'aaaa1111-0000-0000-0000-000000000001')
  = (select token from first_token),
  'and the same link, so one player never scatters two URLs for one week'
);

select public.assert(
  (select display_name = 'Nina renamed' and title_name is null
   from public.share_cards
   where user_id = 'aaaa1111-0000-0000-0000-000000000001'),
  'resharing refreshes what the card says about them'
);

-- A different week is a different card.
select public.create_share_card(
  'aaaa1111-0000-0000-0000-000000000001',
  (select id from public.weekly_cycles where monday = '2026-08-24'),
  '2026-08-24', 'Nina', null,
  -2.0, 0.5, -2.5, null, null, null, 3, '[]'::jsonb
);

select public.assert(
  (select count(*) from public.share_cards
   where user_id = 'aaaa1111-0000-0000-0000-000000000001') = 2,
  'each week gets its own card'
);

select public.assert(
  (select count(distinct token) from public.share_cards) = 2,
  'and its own link'
);

-- ---------------------------------------------------------------------------
-- Taking a card back
-- ---------------------------------------------------------------------------

select public.assert(
  public.revoke_share_card(
    'aaaa1111-0000-0000-0000-000000000001',
    (select id from public.share_cards
     where user_id = 'aaaa1111-0000-0000-0000-000000000001' and monday = '2026-08-17')
  ) = true,
  'a player can take back a card they shared'
);

select public.assert(
  (select revoked_at is not null from public.share_cards
   where user_id = 'aaaa1111-0000-0000-0000-000000000001' and monday = '2026-08-17'),
  'and it is marked as taken back rather than deleted, so the link stays dead'
);

select public.assert(
  public.revoke_share_card(
    'bbbb2222-0000-0000-0000-000000000002',
    (select id from public.share_cards
     where user_id = 'aaaa1111-0000-0000-0000-000000000001' and monday = '2026-08-24')
  ) = false,
  'one player cannot take down another player''s card'
);

select public.assert(
  (select revoked_at is null from public.share_cards
   where user_id = 'aaaa1111-0000-0000-0000-000000000001' and monday = '2026-08-24'),
  'and the attempt changes nothing'
);

-- Sharing again after revoking must not resurrect the dead link.
select public.create_share_card(
  'aaaa1111-0000-0000-0000-000000000001',
  (select id from public.weekly_cycles where monday = '2026-08-17'),
  '2026-08-17', 'Nina', null,
  4.2, 1.1, 3.1, 'Friday Club', 2, 6, 8,
  '[1.0, 2.5, -1.0, 3.4, 4.2]'::jsonb
);

select public.assert(
  (select token from public.share_cards
   where user_id = 'aaaa1111-0000-0000-0000-000000000001' and monday = '2026-08-17')
  <> (select token from first_token),
  'sharing again after revoking mints a new link, so the old one stays dead'
);

select public.assert(
  (select revoked_at is null from public.share_cards
   where user_id = 'aaaa1111-0000-0000-0000-000000000001' and monday = '2026-08-17'),
  'and the new card is live again'
);

-- ---------------------------------------------------------------------------
-- Nobody but the service role writes any of this
-- ---------------------------------------------------------------------------

do $$
begin
  begin
    perform set_config('request.jwt.claims',
      '{"sub": "aaaa1111-0000-0000-0000-000000000001"}', true);
    perform set_config('role', 'authenticated', true);

    insert into public.share_cards
      (user_id, cycle_id, token, display_name, return_percent, monday)
    values
      ('aaaa1111-0000-0000-0000-000000000001',
       (select id from public.weekly_cycles where monday = '2026-08-24'),
       'forged', 'Nina', 999, '2026-08-24');

    raise exception 'FAILED: a player forged a share card';
  exception when insufficient_privilege then
    raise notice 'ok: a player cannot write a share card directly';
  end;
end $$;

do $$
begin
  begin
    perform set_config('request.jwt.claims',
      '{"sub": "aaaa1111-0000-0000-0000-000000000001"}', true);
    perform set_config('role', 'authenticated', true);

    perform public.record_portfolio_mark(
      (select id from public.portfolios
       where user_id = 'aaaa1111-0000-0000-0000-000000000001'),
      '2026-08-20', 500000, 400);

    raise exception 'FAILED: a player recorded their own mark';
  exception when insufficient_privilege then
    raise notice 'ok: a player cannot record a mark on their own portfolio';
  end;

  begin
    perform set_config('request.jwt.claims',
      '{"sub": "aaaa1111-0000-0000-0000-000000000001"}', true);
    perform set_config('role', 'authenticated', true);

    perform public.create_share_card(
      'aaaa1111-0000-0000-0000-000000000001',
      (select id from public.weekly_cycles where monday = '2026-08-24'),
      '2026-08-24', 'Nina', null, 999, 0, 999, null, null, null, 0, '[]'::jsonb);

    raise exception 'FAILED: a player made their own card';
  exception when insufficient_privilege then
    raise notice 'ok: a player cannot call create_share_card directly';
  end;
end $$;

-- ---------------------------------------------------------------------------
-- Reading
-- ---------------------------------------------------------------------------

begin;
  set local request.jwt.claims = '{"sub": "aaaa1111-0000-0000-0000-000000000001"}';
  set local role authenticated;

  select public.assert(
    (select count(*) from public.share_cards) = 2,
    'a player sees their own cards and nobody else''s'
  );

  select public.assert(
    (select count(*) from public.portfolio_marks) = 3,
    'and the marks on their own portfolios only'
  );
commit;

begin;
  set local role anon;

  select public.assert(
    (select count(*) from public.share_cards) = 0,
    'a signed out visitor cannot list the cards, only follow a link they hold'
  );
commit;

-- ---------------------------------------------------------------------------
-- Closing an account
-- ---------------------------------------------------------------------------

delete from auth.users where id = 'aaaa1111-0000-0000-0000-000000000001';

select public.assert(
  (select count(*) from public.share_cards
   where user_id = 'aaaa1111-0000-0000-0000-000000000001') = 0,
  'closing an account takes every card they shared down with it'
);

select public.assert(
  (select count(*) from public.portfolio_marks) = 0,
  'and the daily marks behind them'
);
