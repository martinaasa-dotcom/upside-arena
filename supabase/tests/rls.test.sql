-- Tests for the phase 1 schema: signup trigger, row level security, the
-- guarded columns and the age-gate latch.
--
-- Run with scripts/test-db.sh. Needs a plain Postgres and shim.sql, not a
-- Supabase project, so the security rules can be checked on any machine.

\set ON_ERROR_STOP on

-- Assertions report through notices on stderr, so silence result rows.
\o /dev/null

create or replace function public.assert(condition boolean, label text)
returns void
language plpgsql
as $$
begin
  if condition is not true then
    raise exception 'FAILED: %', label;
  end if;
  raise notice 'ok: %', label;
end;
$$;

grant execute on function public.assert(boolean, text) to authenticated, anon;

-- Two players, created the way Supabase creates them.
insert into auth.users (id, email, raw_user_meta_data)
values
  ('11111111-1111-1111-1111-111111111111', 'sarah@example.com',
   '{"full_name": "Sarah Chen"}'::jsonb),
  ('22222222-2222-2222-2222-222222222222', 'marcus@example.com', '{}'::jsonb);

-- ---------------------------------------------------------------------------
-- The signup trigger
-- ---------------------------------------------------------------------------

select public.assert(
  (select count(*) from public.profiles) = 2,
  'a profile is created for every new auth user'
);

select public.assert(
  (select display_name from public.profiles
   where id = '11111111-1111-1111-1111-111111111111') = 'Sarah Chen',
  'the display name is taken from the signup metadata'
);

select public.assert(
  (select display_name from public.profiles
   where id = '22222222-2222-2222-2222-222222222222') = 'marcus',
  'without metadata the display name falls back to the email name'
);

select public.assert(
  (select rating from public.profiles
   where id = '11111111-1111-1111-1111-111111111111') = 1000,
  'a new player starts at the default rating'
);

select public.assert(
  (select age_confirmed_at is null from public.profiles
   where id = '11111111-1111-1111-1111-111111111111'),
  'the age gate is unconfirmed until onboarding records it'
);

-- ---------------------------------------------------------------------------
-- Row level security: reads
-- ---------------------------------------------------------------------------

begin;
  set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111"}';
  set local role authenticated;

  select public.assert(
    (select count(*) from public.profiles) = 1,
    'a player sees exactly one profile, their own'
  );

  select public.assert(
    (select count(*) from public.profiles
     where id = '22222222-2222-2222-2222-222222222222') = 0,
    'a player cannot read another player''s profile'
  );
commit;

begin;
  set local role anon;

  select public.assert(
    (select count(*) from public.profiles) = 0,
    'a signed-out visitor reads no profiles at all'
  );
commit;

-- ---------------------------------------------------------------------------
-- Row level security: writes
-- ---------------------------------------------------------------------------

begin;
  set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111"}';
  set local role authenticated;

  update public.profiles
  set display_name = 'Sarah C', handle = 'sarah_c'
  where id = '11111111-1111-1111-1111-111111111111';

  select public.assert(
    (select handle from public.profiles
     where id = '11111111-1111-1111-1111-111111111111') = 'sarah_c',
    'a player can set their own name and player tag'
  );

  -- The policy filters the row out, so this updates nothing rather than erroring.
  update public.profiles
  set display_name = 'Hacked'
  where id = '22222222-2222-2222-2222-222222222222';
commit;

select public.assert(
  (select display_name from public.profiles
   where id = '22222222-2222-2222-2222-222222222222') = 'marcus',
  'a player cannot write to another player''s profile'
);

-- ---------------------------------------------------------------------------
-- Guarded columns: the game awards these, a player never sets them
-- ---------------------------------------------------------------------------

begin;
  set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111"}';
  set local role authenticated;

  update public.profiles
  set rating = 4999,
      weeks_played = 500,
      longest_streak = 999,
      best_week_return = 1000.0,
      career_alpha_avg = 1000.0
  where id = '11111111-1111-1111-1111-111111111111';
commit;

select public.assert(
  (select rating from public.profiles
   where id = '11111111-1111-1111-1111-111111111111') = 1000,
  'a player cannot raise their own rating'
);

select public.assert(
  (select weeks_played = 0 and longest_streak = 0
      and best_week_return is null and career_alpha_avg is null
   from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  'a player cannot invent their own lifetime record'
);

-- The service role is the game itself, and must be able to award them.
begin;
  set local role service_role;

  update public.profiles
  set rating = 1200, weeks_played = 3
  where id = '11111111-1111-1111-1111-111111111111';
commit;

select public.assert(
  (select rating = 1200 and weeks_played = 3 from public.profiles
   where id = '11111111-1111-1111-1111-111111111111'),
  'the service role can award a rating and a played week'
);

-- ---------------------------------------------------------------------------
-- The age gate is a one-way latch
-- ---------------------------------------------------------------------------

begin;
  set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111"}';
  set local role authenticated;

  update public.profiles
  set age_confirmed_at = '2026-08-21T10:00:00Z', onboarded_at = now()
  where id = '11111111-1111-1111-1111-111111111111';
commit;

select public.assert(
  (select age_confirmed_at is not null from public.profiles
   where id = '11111111-1111-1111-1111-111111111111'),
  'onboarding can record the age confirmation'
);

begin;
  set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111"}';
  set local role authenticated;

  update public.profiles
  set age_confirmed_at = null
  where id = '11111111-1111-1111-1111-111111111111';
commit;

select public.assert(
  (select age_confirmed_at is not null from public.profiles
   where id = '11111111-1111-1111-1111-111111111111'),
  'a recorded age confirmation can never be cleared'
);

-- ---------------------------------------------------------------------------
-- Constraints
-- ---------------------------------------------------------------------------

do $$
begin
  begin
    perform set_config(
      'request.jwt.claims',
      '{"sub": "22222222-2222-2222-2222-222222222222"}',
      true
    );
    set local role authenticated;

    update public.profiles set handle = 'sarah_c'
    where id = '22222222-2222-2222-2222-222222222222';

    raise exception 'FAILED: two players were allowed the same player tag';
  exception
    when unique_violation then
      raise notice 'ok: a player tag cannot be taken twice';
  end;
end
$$;

do $$
begin
  begin
    update public.profiles set handle = 'No Spaces Allowed'
    where id = '22222222-2222-2222-2222-222222222222';

    raise exception 'FAILED: a malformed player tag was accepted';
  exception
    when check_violation then
      raise notice 'ok: a malformed player tag is rejected';
  end;
end
$$;

-- ---------------------------------------------------------------------------
-- Terms acceptances
-- ---------------------------------------------------------------------------

begin;
  set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111"}';
  set local role authenticated;

  insert into public.terms_acceptances (user_id, document, version)
  values
    ('11111111-1111-1111-1111-111111111111', 'terms', '2026-08-21'),
    ('11111111-1111-1111-1111-111111111111', 'privacy', '2026-08-21');

  select public.assert(
    (select count(*) from public.terms_acceptances) = 2,
    'a player can record agreeing to both documents'
  );
commit;

do $$
begin
  begin
    perform set_config(
      'request.jwt.claims',
      '{"sub": "11111111-1111-1111-1111-111111111111"}',
      true
    );
    set local role authenticated;

    insert into public.terms_acceptances (user_id, document, version)
    values ('22222222-2222-2222-2222-222222222222', 'terms', '2026-08-21');

    raise exception 'FAILED: a player recorded consent on behalf of someone else';
  exception
    when insufficient_privilege then
      raise notice 'ok: a player cannot record consent for another account';
  end;
end
$$;

begin;
  set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222"}';
  set local role authenticated;

  select public.assert(
    (select count(*) from public.terms_acceptances) = 0,
    'a player cannot read another account''s agreements'
  );
commit;

-- ---------------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------------

begin;
  set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111"}';
  set local role authenticated;

  update public.profiles set display_name = 'Sarah Chen'
  where id = '11111111-1111-1111-1111-111111111111';

  select public.assert(
    (select updated_at > created_at from public.profiles
     where id = '11111111-1111-1111-1111-111111111111'),
    'updated_at moves when a profile changes'
  );
commit;

-- ---------------------------------------------------------------------------
-- Account deletion
-- ---------------------------------------------------------------------------

begin;
  set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111"}';
  set local role authenticated;

  select public.delete_own_account();
commit;

select public.assert(
  (select count(*) from auth.users
   where id = '11111111-1111-1111-1111-111111111111') = 0,
  'closing an account erases the account itself'
);

select public.assert(
  (select count(*) from public.profiles
   where id = '11111111-1111-1111-1111-111111111111') = 0,
  'closing an account erases the profile with it'
);

select public.assert(
  (select count(*) from public.terms_acceptances
   where user_id = '11111111-1111-1111-1111-111111111111') = 0,
  'closing an account erases the recorded agreements with it'
);

select public.assert(
  (select count(*) from public.profiles
   where id = '22222222-2222-2222-2222-222222222222') = 1,
  'closing one account leaves every other account untouched'
);

do $$
begin
  begin
    perform set_config('request.jwt.claims', '', true);
    set local role anon;
    perform public.delete_own_account();
    raise exception 'FAILED: a signed-out caller was allowed to delete an account';
  exception
    when insufficient_privilege then
      raise notice 'ok: a signed-out caller cannot delete an account';
    when others then
      if sqlerrm like '%not signed in%' then
        raise notice 'ok: a signed-out caller cannot delete an account';
      else
        raise;
      end if;
  end;
end
$$;
