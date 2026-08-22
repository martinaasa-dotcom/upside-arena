-- Where the test database differs from the real one, in ways that matter.
--
-- These suites run against a plain Postgres. Supabase is not a plain Postgres,
-- and the gap is not academic: on 2026-08-22 every one of the four hundred and
-- fifteen assertions passed against a score_cycle that production could not
-- execute at all. Settlement failed on every attempt, no week could be scored,
-- and the only trace was a warning in a cron log.
--
-- The cause was one statement:
--
--     delete from newly_scored;
--
-- PostgREST connects as `authenticator`, which preloads supautils and
-- safeupdate, and safeupdate refuses a DELETE with no WHERE clause. A plain
-- Postgres has no such rule, so the test suite was happy.
--
-- The extension cannot be installed here, so this asks the question it would
-- have asked: does any function contain a DELETE that safeupdate would reject?
-- Reading pg_proc rather than the migration files, so a function defined
-- anywhere, or replaced later, is still covered.

select public.assert(
  not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace and n.nspname = 'public'
    where p.prosrc ~* 'delete[[:space:]]+from[[:space:]]+[a-zA-Z_.]+[[:space:]]*;'
  ),
  'no function deletes without a where clause, which production refuses to run'
);

/*
  The same guard applies to UPDATE, and is deliberately not asserted here.

  An UPDATE and its WHERE are routinely several lines apart, and a matcher
  loose enough to span that is loose enough to flag correct code. A check that
  cries wolf is a check somebody switches off, and then the real one goes with
  it. The rule is written down instead: every UPDATE and DELETE in a function
  that the API can reach needs a WHERE clause, even when it means `where true`.
*/

-- And the reason the rule bites: these run as service_role through PostgREST.
select public.assert(
  (select count(*) from pg_proc p
   join pg_namespace n on n.oid = p.pronamespace and n.nspname = 'public'
   where p.prosecdef) > 0,
  'and the functions this applies to are the security definer ones the API calls'
);
