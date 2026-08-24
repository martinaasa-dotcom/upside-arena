/*
  Somewhere to write down what broke.

  Until now a failure told nobody. A screen that would not render logged to
  the browser console, where exactly one person could see it and only if they
  happened to have it open, and the server's own errors went to the host's log,
  which on the plan Arena runs on is kept for an hour. So the honest state of
  affairs was that a bug was found when a player wrote in about it, which is
  the most expensive possible way to find one and depends on somebody caring
  enough to write.

  This is a table, and that is deliberately all it is. A paid monitoring
  service would do more and cost a subscription for a game with no revenue;
  the useful nine tenths of one is knowing what is failing, how often, and
  where.

  Two properties matter more than anything the table holds.

    It is keyed on a fingerprint rather than on time, so a page failing for
    three hundred people is one row with a count of three hundred, not three
    hundred rows. A log that floods is a log nobody reads, and it is also how
    a small bug turns into a database full of itself.

    It holds nothing about who. No user id, no address, no session, no
    request headers, no query string. What is written down is what broke and
    where, which is the whole of what is needed to fix it, and it means this
    table can never become a thing that has to be explained to somebody.
*/

create table public.error_reports (
  /* md5 of what broke and where, which is what makes a repeat a count. */
  fingerprint text primary key,

  kind text not null check (kind in ('client', 'server')),

  /* The message, trimmed. Never a stack: a stack is a map of the source. */
  message text not null,

  /* The route it happened on, without a query string. */
  at text,

  /* Next's own digest, when there is one, so a report can be matched to a
     host log line while that line still exists. */
  digest text,

  seen integer not null default 1,
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),

  constraint error_reports_message_length check (char_length(message) between 1 and 300),
  constraint error_reports_at_length check (at is null or char_length(at) <= 120),
  constraint error_reports_digest_length check (digest is null or char_length(digest) <= 64)
);

create index error_reports_last_seen_idx on public.error_reports (last_seen desc);

comment on table public.error_reports is
  'What broke, where, and how often. Nothing about who.';

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
-- Enabled with no policy, which denies everybody. The service role bypasses
-- it, and the owner reads this through a page that already checks who they
-- are.

alter table public.error_reports enable row level security;

-- ---------------------------------------------------------------------------
-- record_error
-- ---------------------------------------------------------------------------

create or replace function public.record_error(
  p_kind text,
  p_message text,
  p_at text default null,
  p_digest text default null
)
returns public.error_reports
language plpgsql
security definer
set search_path = public
as $$
declare
  report public.error_reports;
  clean_message text;
  clean_at text;
  clean_digest text;
begin
  clean_message := left(nullif(btrim(p_message), ''), 300);
  if clean_message is null then
    raise exception 'an error report needs something to say';
  end if;

  clean_at := left(nullif(btrim(coalesce(p_at, '')), ''), 120);
  clean_digest := left(nullif(btrim(coalesce(p_digest, '')), ''), 64);

  insert into public.error_reports (fingerprint, kind, message, at, digest)
  values (
    md5(p_kind || '|' || clean_message || '|' || coalesce(clean_at, '')),
    p_kind,
    clean_message,
    clean_at,
    clean_digest
  )
  on conflict (fingerprint) do update
  set seen = public.error_reports.seen + 1,
      last_seen = now(),
      -- The newest digest, because it is the one still findable in a host log.
      digest = coalesce(excluded.digest, public.error_reports.digest)
  returning * into report;

  return report;
end;
$$;

revoke all on function public.record_error(text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.record_error(text, text, text, text) to service_role;
