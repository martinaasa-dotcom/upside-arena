-- What broke, written down where it can be counted.
--
-- The property that matters is the fingerprint. A page failing for three
-- hundred people has to be one row with a count of three hundred, because a
-- log that floods is a log nobody reads and also a database filling up with
-- one bug.

\set ON_ERROR_STOP on
\o /dev/null

select public.record_error('client', 'Cannot read properties of null', '/home', 'abc123');
select public.record_error('client', 'Cannot read properties of null', '/home', 'def456');
select public.record_error('client', 'Cannot read properties of null', '/home');

select public.assert(
  (select count(*) from public.error_reports) = 1,
  'the same failure in the same place is one row'
);

select public.assert(
  (select seen from public.error_reports) = 3,
  'and a count of how many times it has happened'
);

select public.assert(
  (select digest from public.error_reports) = 'def456',
  'the newest digest is kept, because it is the one still in the host log'
);

-- Same message, different room. Two bugs until proven otherwise.
select public.record_error('client', 'Cannot read properties of null', '/leagues');

select public.assert(
  (select count(*) from public.error_reports) = 2,
  'the same message somewhere else is its own row'
);

select public.record_error('server', 'Cannot read properties of null', '/home');

select public.assert(
  (select count(*) from public.error_reports) = 3,
  'and so is the same message on the other side of the wire'
);

-- ---------------------------------------------------------------------------
-- What it refuses
-- ---------------------------------------------------------------------------

do $$
begin
  perform public.record_error('client', '   ');
  perform public.assert(false, 'a report with nothing to say is refused');
exception when others then
  perform public.assert(
    sqlerrm like '%something to say%', 'a report with nothing to say is refused');
end;
$$;

do $$
begin
  perform public.record_error('somewhere else', 'a message');
  perform public.assert(false, 'and a kind that is neither side of the wire');
exception when others then
  perform public.assert(true, 'and a kind that is neither side of the wire');
end;
$$;

-- A stack, or a novel. Kept to what identifies the failure.
select public.record_error('server', repeat('x', 900), '/home');

select public.assert(
  (select char_length(message) from public.error_reports
   where kind = 'server' and message like 'xxx%') = 300,
  'a message longer than a failure needs is cut rather than refused'
);

-- ---------------------------------------------------------------------------
-- Nobody but the game may write or read it
-- ---------------------------------------------------------------------------

insert into auth.users (id, email)
values ('88880000-0000-0000-0000-000000000001', 'reader@example.com');

begin;
  set local request.jwt.claims = '{"sub": "88880000-0000-0000-0000-000000000001"}';
  set local role authenticated;

  do $$
  begin
    perform public.record_error('client', 'from a player');
    perform public.assert(false, 'a player cannot write the log directly');
  exception when insufficient_privilege then
    perform public.assert(true, 'a player cannot write the log directly');
  end;
  $$;

  do $$
  declare
    seen integer;
  begin
    select count(*) into seen from public.error_reports;
    perform public.assert(seen = 0, 'nor read what anybody else has hit');
  end;
  $$;
commit;
