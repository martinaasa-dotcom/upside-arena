-- Tests for private leagues: creating, joining by code, limits, leaving, and
-- who is allowed to see or change what.

\set ON_ERROR_STOP on
\o /dev/null

insert into auth.users (id, email, raw_user_meta_data) values
  ('eeeeeeee-0000-0000-0000-000000000001', 'ada@example.com', '{}'::jsonb),
  ('ffffffff-0000-0000-0000-000000000002', 'bo@example.com', '{}'::jsonb),
  ('99999999-0000-0000-0000-000000000003', 'cy@example.com', '{}'::jsonb),
  ('88888888-0000-0000-0000-000000000004', 'di@example.com', '{}'::jsonb);

-- ---------------------------------------------------------------------------
-- Creating
-- ---------------------------------------------------------------------------

select public.create_league('eeeeeeee-0000-0000-0000-000000000001', 'Sunday Roasters', '☕');

select public.assert(
  (select count(*) from public.leagues) = 1,
  'a league is created'
);

select public.assert(
  (select name from public.leagues) = 'Sunday Roasters',
  'the league keeps the name it was given'
);

select public.assert(
  (select count(*) from public.league_members
   where user_id = 'eeeeeeee-0000-0000-0000-000000000001' and role = 'owner') = 1,
  'whoever made the league is in it, as its owner'
);

select public.assert(
  (select invite_code from public.leagues) ~ '^[A-Z0-9]{8}$',
  'the league gets an eight character invite code'
);

-- A code read aloud or typed from a screenshot must land on the right league,
-- so the ambiguous characters are not in the alphabet.
select public.assert(
  (select invite_code from public.leagues) !~ '[IO01]',
  'invite codes avoid characters that get misread'
);

select public.assert(
  (select count(*) from public.leagues where btrim(name) = '') = 0,
  'a league name is trimmed'
);

do $$
begin
  begin
    perform public.create_league('eeeeeeee-0000-0000-0000-000000000001', '   ');
    raise exception 'FAILED: a league was created with a blank name';
  exception when others then
    if sqlerrm like '%needs a name%' then
      raise notice 'ok: a league cannot be created without a name';
    else raise; end if;
  end;
end $$;

-- ---------------------------------------------------------------------------
-- Joining
-- ---------------------------------------------------------------------------

select public.join_league(
  'ffffffff-0000-0000-0000-000000000002',
  (select invite_code from public.leagues));

select public.assert(
  (select count(*) from public.league_members) = 2,
  'a code lets someone else into the league'
);

select public.assert(
  (select role from public.league_members
   where user_id = 'ffffffff-0000-0000-0000-000000000002') = 'member',
  'joining makes you a member, not an owner'
);

-- Following an invite twice should take you to the league, not scold you.
select public.join_league(
  'ffffffff-0000-0000-0000-000000000002',
  (select invite_code from public.leagues));

select public.assert(
  (select count(*) from public.league_members) = 2,
  'following the same invite twice does not add you twice'
);

-- Lower case and stray spaces are what a pasted code actually looks like.
select public.join_league(
  '99999999-0000-0000-0000-000000000003',
  (select '  ' || lower(invite_code) || ' ' from public.leagues));

select public.assert(
  (select count(*) from public.league_members) = 3,
  'a pasted code still works with odd spacing and lower case'
);

do $$
begin
  begin
    perform public.join_league('88888888-0000-0000-0000-000000000004', 'NOTACODE');
    raise exception 'FAILED: a made up code let someone in';
  exception when others then
    if sqlerrm like '%no league with that code%' then
      raise notice 'ok: a made up code does not open a league';
    else raise; end if;
  end;
end $$;

-- ---------------------------------------------------------------------------
-- Limits
-- ---------------------------------------------------------------------------

do $$
declare code text;
begin
  -- A league of two, already holding two people.
  select public.create_league('88888888-0000-0000-0000-000000000004', 'Tiny', null, 3, 2)
    into strict code;
exception when others then null;
end $$;

do $$
declare small_code text;
begin
  select invite_code into small_code
  from public.leagues where name = 'Tiny';

  perform public.join_league('eeeeeeee-0000-0000-0000-000000000001', small_code);

  begin
    perform public.join_league('ffffffff-0000-0000-0000-000000000002', small_code);
    raise exception 'FAILED: a full league accepted another member';
  exception when others then
    if sqlerrm like '%full%' then
      raise notice 'ok: a full league turns the next person away';
    else raise; end if;
  end;
end $$;

do $$
begin
  begin
    -- Already owns one, and the limit here is one.
    perform public.create_league('eeeeeeee-0000-0000-0000-000000000001', 'One Too Many', null, 1, 20);
    raise exception 'FAILED: the league limit was ignored';
  exception when others then
    if sqlerrm like '%league limit reached%' then
      raise notice 'ok: there is a limit on how many leagues one person runs';
    else raise; end if;
  end;
end $$;

-- ---------------------------------------------------------------------------
-- Leaving
-- ---------------------------------------------------------------------------

select public.leave_league(
  '99999999-0000-0000-0000-000000000003',
  (select id from public.leagues where name = 'Sunday Roasters'));

select public.assert(
  (select count(*) from public.league_members
   where league_id = (select id from public.leagues where name = 'Sunday Roasters')) = 2,
  'leaving removes you from the roster'
);

-- The owner leaving must not take everyone else's league with them.
select public.leave_league(
  'eeeeeeee-0000-0000-0000-000000000001',
  (select id from public.leagues where name = 'Sunday Roasters'));

select public.assert(
  (select count(*) from public.leagues where name = 'Sunday Roasters') = 1,
  'the owner leaving does not delete a league other people are in'
);

select public.assert(
  (select owner_id from public.leagues where name = 'Sunday Roasters')
    = 'ffffffff-0000-0000-0000-000000000002',
  'the league passes to whoever joined earliest'
);

select public.assert(
  (select role from public.league_members
   where league_id = (select id from public.leagues where name = 'Sunday Roasters')
     and user_id = 'ffffffff-0000-0000-0000-000000000002') = 'owner',
  'the new owner is marked as owner on the roster'
);

-- The last person out turns off the lights.
select public.leave_league(
  'ffffffff-0000-0000-0000-000000000002',
  (select id from public.leagues where name = 'Sunday Roasters'));

select public.assert(
  (select count(*) from public.leagues where name = 'Sunday Roasters') = 0,
  'the last member leaving removes the empty league'
);

-- ---------------------------------------------------------------------------
-- Renaming
-- ---------------------------------------------------------------------------

do $$
declare lid uuid;
begin
  lid := (select id from public.leagues where name = 'Tiny');

  perform public.rename_league('88888888-0000-0000-0000-000000000004', lid, 'Tiny But Mighty', '🔥');

  begin
    perform public.rename_league('eeeeeeee-0000-0000-0000-000000000001', lid, 'Hijacked');
    raise exception 'FAILED: a member renamed someone else''s league';
  exception when others then
    if sqlerrm like '%only the person who made the league%' then
      raise notice 'ok: only the owner can rename a league';
    else raise; end if;
  end;
end $$;

select public.assert(
  (select name from public.leagues where id in
    (select league_id from public.league_members
     where user_id = '88888888-0000-0000-0000-000000000004')) = 'Tiny But Mighty',
  'the owner can rename their league'
);

-- ---------------------------------------------------------------------------
-- Who can see and change what
-- ---------------------------------------------------------------------------

-- Someone outside the league.
insert into auth.users (id, email) values
  ('77777777-0000-0000-0000-000000000005', 'outsider@example.com');

begin;
  set local request.jwt.claims = '{"sub": "77777777-0000-0000-0000-000000000005"}';
  set local role authenticated;

  select public.assert(
    (select count(*) from public.leagues) = 0,
    'a private league is invisible to someone not in it'
  );

  select public.assert(
    (select count(*) from public.league_members) = 0,
    'so is its roster'
  );
commit;

begin;
  set local request.jwt.claims = '{"sub": "88888888-0000-0000-0000-000000000004"}';
  set local role authenticated;

  select public.assert(
    (select count(*) from public.leagues) = 1,
    'a member sees the league they are in'
  );

  select public.assert(
    (select count(*) from public.league_members) = 2,
    'a member sees who else is in it'
  );
commit;

do $$
declare lid uuid := (select id from public.leagues limit 1);
begin
  perform set_config('request.jwt.claims',
    '{"sub": "77777777-0000-0000-0000-000000000005"}', true);
  set local role authenticated;

  begin
    insert into public.league_members (league_id, user_id, role)
    values (lid, '77777777-0000-0000-0000-000000000005', 'member');
    raise exception 'FAILED: someone added themselves to a private league';
  exception when insufficient_privilege then
    raise notice 'ok: nobody can add themselves to a league they were not invited to';
  end;

  begin
    perform public.join_league('77777777-0000-0000-0000-000000000005', 'ABCDEFGH');
    raise exception 'FAILED: a player called join_league directly';
  exception when insufficient_privilege then
    raise notice 'ok: a player cannot call the join function directly';
  end;

  begin
    update public.leagues set name = 'Mine now' where id = lid;
    if found then raise exception 'FAILED: an outsider renamed a league'; end if;
    raise notice 'ok: an outsider cannot rename a league';
  exception when insufficient_privilege then
    raise notice 'ok: an outsider cannot rename a league';
  end;
end $$;

-- ---------------------------------------------------------------------------
-- A profile stays private even to people in your league
-- ---------------------------------------------------------------------------
-- Standings are built on the server, which reads what it needs with the
-- service role and returns only a name, tag and picture. The roster must not
-- become a way to read another player's rating or lifetime record.

begin;
  set local request.jwt.claims = '{"sub": "88888888-0000-0000-0000-000000000004"}';
  set local role authenticated;

  select public.assert(
    (select count(*) from public.profiles) = 1,
    'a player still reads only their own profile, league or no league'
  );
commit;

-- ---------------------------------------------------------------------------
-- Closing an account
-- ---------------------------------------------------------------------------

delete from auth.users where id = '88888888-0000-0000-0000-000000000004';

select public.assert(
  (select count(*) from public.league_members
   where user_id = '88888888-0000-0000-0000-000000000004') = 0,
  'closing an account takes you off every roster'
);
