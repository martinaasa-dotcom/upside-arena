-- Local test shim. NOT part of the deployed schema.
--
-- Recreates only the parts of a Supabase project that the migration leans on:
-- the auth schema, the three PostgREST roles, and auth.uid(). It exists so the
-- migration, its triggers and its row level security can be tested against a
-- plain Postgres without Docker or a hosted project.

create schema if not exists auth;

do $$
begin
  if not exists (select from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end
$$;

-- Supabase's real auth.users has far more columns. These are the ones the
-- signup trigger reads.
create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Matches Supabase: the subject claim of the request's JWT.
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  -- An absent or empty claim must yield null, not a JSON cast error, which is
  -- how a signed-out request reaches a security definer function.
  select nullif(
    nullif(current_setting('request.jwt.claims', true), '')::json ->> 'sub',
    ''
  )::uuid
$$;

grant usage on schema auth to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;

alter default privileges in schema public
  grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on functions to anon, authenticated, service_role;
