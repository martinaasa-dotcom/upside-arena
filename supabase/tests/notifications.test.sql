-- Tests for the notification engine: settings, subscriptions, the daily cap,
-- and the rule that the same event is never sent twice.

\set ON_ERROR_STOP on
\o /dev/null

insert into auth.users (id, email) values
  ('aaaa1111-0000-0000-0000-000000000001', 'nina@example.com'),
  ('bbbb2222-0000-0000-0000-000000000002', 'omar@example.com');

-- ---------------------------------------------------------------------------
-- Settings
-- ---------------------------------------------------------------------------

select public.save_notification_settings(
  'aaaa1111-0000-0000-0000-000000000001', true, true, true, true, true, 'Europe/Tallinn');

select public.assert(
  (select timezone from public.notification_settings
   where user_id = 'aaaa1111-0000-0000-0000-000000000001') = 'Europe/Tallinn',
  'the player''s own timezone is kept, so nothing arrives in their night'
);

select public.save_notification_settings(
  'aaaa1111-0000-0000-0000-000000000001', false, true, false, true, true, null);

select public.assert(
  (select push_enabled = false and email_enabled = true and rival_alerts = false
   from public.notification_settings
   where user_id = 'aaaa1111-0000-0000-0000-000000000001'),
  'each channel and each kind can be turned off on its own'
);

select public.assert(
  (select timezone from public.notification_settings
   where user_id = 'aaaa1111-0000-0000-0000-000000000001') = 'Europe/Tallinn',
  'saving without a timezone leaves the one already there'
);

-- ---------------------------------------------------------------------------
-- Push subscriptions
-- ---------------------------------------------------------------------------

select public.save_push_subscription(
  'aaaa1111-0000-0000-0000-000000000001',
  'https://push.example/endpoint-a', 'key-a', 'auth-a', 'Firefox');

select public.assert(
  (select count(*) from public.push_subscriptions
   where user_id = 'aaaa1111-0000-0000-0000-000000000001') = 1,
  'a browser can subscribe to push'
);

-- The same browser again is the same subscription, not a second one.
select public.save_push_subscription(
  'aaaa1111-0000-0000-0000-000000000001',
  'https://push.example/endpoint-a', 'key-a2', 'auth-a2', 'Firefox');

select public.assert(
  (select count(*) from public.push_subscriptions) = 1,
  'subscribing twice from one browser does not make two subscriptions'
);

select public.assert(
  (select p256dh from public.push_subscriptions
   where endpoint = 'https://push.example/endpoint-a') = 'key-a2',
  'a refreshed subscription replaces the old keys'
);

-- A shared machine: the second person to sign in takes the subscription.
select public.save_push_subscription(
  'bbbb2222-0000-0000-0000-000000000002',
  'https://push.example/endpoint-a', 'key-b', 'auth-b', 'Firefox');

select public.assert(
  (select user_id from public.push_subscriptions
   where endpoint = 'https://push.example/endpoint-a')
   = 'bbbb2222-0000-0000-0000-000000000002',
  'signing in on a shared browser moves the subscription to the new account'
);

select public.assert(
  (select count(*) from public.push_subscriptions
   where user_id = 'aaaa1111-0000-0000-0000-000000000001') = 0,
  'and the previous account stops receiving push on a device that is not theirs'
);

select public.delete_push_subscription('https://push.example/endpoint-a');

select public.assert(
  (select count(*) from public.push_subscriptions) = 0,
  'a subscription can be removed'
);

-- ---------------------------------------------------------------------------
-- Sending the same thing twice
-- ---------------------------------------------------------------------------

select public.assert(
  public.record_notification(
    'aaaa1111-0000-0000-0000-000000000001', 'rival_passed',
    'passed:league-1:sarah:2026-08-21', 'Sarah passed you',
    'Sarah is 0.4% ahead in Sunday Roasters.', '/leagues/league-1', 'push') = true,
  'a new event is claimed'
);

select public.assert(
  public.record_notification(
    'aaaa1111-0000-0000-0000-000000000001', 'rival_passed',
    'passed:league-1:sarah:2026-08-21', 'Sarah passed you',
    'Sarah is 0.4% ahead in Sunday Roasters.', '/leagues/league-1', 'push') = false,
  'the same event is never claimed twice, so the job can run every hour'
);

-- ---------------------------------------------------------------------------
-- The daily cap
-- ---------------------------------------------------------------------------

select public.assert(
  public.record_notification(
    'aaaa1111-0000-0000-0000-000000000001', 'rival_passed',
    'passed:league-1:marcus:2026-08-21', 'Marcus passed you',
    'Marcus is ahead.', '/leagues/league-1', 'push') = true,
  'a second, genuinely different event still goes'
);

select public.assert(
  public.record_notification(
    'aaaa1111-0000-0000-0000-000000000001', 'week_result',
    'week:2026-08-17', 'Your week is in', 'You finished second.', '/home', 'push') = true,
  'and a third'
);

select public.assert(
  public.record_notification(
    'aaaa1111-0000-0000-0000-000000000001', 'streak_reminder',
    'streak:2026-08-21', 'Your streak', 'Today is not counted yet.', '/home', 'push') = false,
  'the fourth in a day is refused, because a muted channel is worth nothing'
);

-- Something not actually sent must not use up the day's allowance.
select public.assert(
  (select count(*) from public.notifications
   where user_id = 'bbbb2222-0000-0000-0000-000000000002') = 0,
  'nothing has been sent to the other player'
);

select public.assert(
  public.record_notification(
    'bbbb2222-0000-0000-0000-000000000002', 'week_result',
    'week:2026-08-17', 'Your week is in', 'You won.', '/home', 'none') = true,
  'a notification with nowhere to go is still recorded'
);

select public.assert(
  public.record_notification(
    'bbbb2222-0000-0000-0000-000000000002', 'rival_passed',
    'passed:x:y:2026-08-21', 'x', 'y', '/home', 'push') = true,
  'and it does not count against the cap, because nobody was disturbed'
);

-- ---------------------------------------------------------------------------
-- Ranks
-- ---------------------------------------------------------------------------

insert into public.leagues (id, name, owner_id, invite_code)
values ('cccc3333-0000-0000-0000-000000000003', 'Test League',
        'aaaa1111-0000-0000-0000-000000000001', 'ABCD2345');

insert into public.league_members (league_id, user_id, role) values
  ('cccc3333-0000-0000-0000-000000000003', 'aaaa1111-0000-0000-0000-000000000001', 'owner'),
  ('cccc3333-0000-0000-0000-000000000003', 'bbbb2222-0000-0000-0000-000000000002', 'member');

select public.assert(
  (select count(*) from public.league_members where last_rank is null) = 2,
  'nobody has a recorded rank before the first pass'
);

select public.update_member_ranks(
  'cccc3333-0000-0000-0000-000000000003',
  '{"aaaa1111-0000-0000-0000-000000000001": 1, "bbbb2222-0000-0000-0000-000000000002": 2}'::jsonb);

select public.assert(
  (select last_rank from public.league_members
   where user_id = 'aaaa1111-0000-0000-0000-000000000001') = 1
  and (select last_rank from public.league_members
   where user_id = 'bbbb2222-0000-0000-0000-000000000002') = 2,
  'the pass records where everyone stood'
);

select public.update_member_ranks(
  'cccc3333-0000-0000-0000-000000000003',
  '{"aaaa1111-0000-0000-0000-000000000001": 2, "bbbb2222-0000-0000-0000-000000000002": 1}'::jsonb);

select public.assert(
  (select last_rank from public.league_members
   where user_id = 'aaaa1111-0000-0000-0000-000000000001') = 2,
  'and the next pass overwrites it, so a change can be noticed'
);

-- ---------------------------------------------------------------------------
-- None of it is writable by a player
-- ---------------------------------------------------------------------------

do $$
begin
  perform set_config('request.jwt.claims',
    '{"sub": "aaaa1111-0000-0000-0000-000000000001"}', true);
  set local role authenticated;

  begin
    update public.notification_settings set push_enabled = true
    where user_id = 'aaaa1111-0000-0000-0000-000000000001';
    if found then raise exception 'FAILED: a player wrote their own settings row'; end if;
    raise notice 'ok: settings change only through the function';
  exception when insufficient_privilege then
    raise notice 'ok: settings change only through the function';
  end;

  begin
    insert into public.push_subscriptions (user_id, endpoint, p256dh, auth)
    values ('aaaa1111-0000-0000-0000-000000000001', 'https://evil/x', 'k', 'a');
    raise exception 'FAILED: a player inserted a push subscription directly';
  exception when insufficient_privilege then
    raise notice 'ok: a player cannot insert a push subscription directly';
  end;

  begin
    perform public.record_notification(
      'aaaa1111-0000-0000-0000-000000000001', 'week_result', 'x', 't', 'b', '/', 'push');
    raise exception 'FAILED: a player claimed a notification';
  exception when insufficient_privilege then
    raise notice 'ok: a player cannot claim a notification';
  end;
end $$;

begin;
  set local request.jwt.claims = '{"sub": "aaaa1111-0000-0000-0000-000000000001"}';
  set local role authenticated;

  select public.assert(
    (select count(*) from public.notifications) = 3,
    'a player reads their own notifications and nobody else''s'
  );
commit;

-- ---------------------------------------------------------------------------
-- Closing an account
-- ---------------------------------------------------------------------------

delete from auth.users where id = 'aaaa1111-0000-0000-0000-000000000001';

select public.assert(
  (select count(*) from public.notification_settings
   where user_id = 'aaaa1111-0000-0000-0000-000000000001') = 0
  and (select count(*) from public.notifications
   where user_id = 'aaaa1111-0000-0000-0000-000000000001') = 0,
  'closing an account takes its settings and its notification history with it'
);

-- ---------------------------------------------------------------------------
-- A battle result is a kind of its own
-- ---------------------------------------------------------------------------
-- It is gated by the same setting as a week result, but it is not one. The
-- kind is what the daily cap counts and what the numbers page reads, so
-- calling a settled battle a week would make both quietly wrong about what
-- the app actually sends.

-- Their own player, because everybody above has either been erased by the
-- check before this one or has already spent some of the daily cap.
insert into auth.users (id, email)
values ('cccc3333-0000-0000-0000-000000000003', 'pia@example.com');

select public.assert(
  public.record_notification(
    'cccc3333-0000-0000-0000-000000000003',
    'battle_result',
    'battle:cccc0000-0000-0000-0000-0000000000ff',
    'You won Silicon',
    'Silicon in The Pit is settled, and you finished first of 5.',
    '/leagues/l1/battle',
    'push'
  ),
  'a settled battle can be recorded as the kind of thing it is'
);

select public.assert(
  not public.record_notification(
    'cccc3333-0000-0000-0000-000000000003',
    'battle_result',
    'battle:cccc0000-0000-0000-0000-0000000000ff',
    'You won Silicon',
    'Silicon in The Pit is settled, and you finished first of 5.',
    '/leagues/l1/battle',
    'push'
  ),
  'and the same battle is never announced twice'
);

do $$
begin
  perform public.record_notification(
    'cccc3333-0000-0000-0000-000000000003',
    'a_kind_nobody_defined',
    'whatever',
    'Title', 'Body', null, 'push'
  );
  raise exception 'should not reach here';
exception
  when others then
    perform public.assert(
      sqlerrm not like 'should not reach here',
      'and a kind nobody defined is still refused'
    );
end
$$;

