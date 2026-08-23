/*
  Closes, for every contest that is running rather than only for the week.

  portfolio_marks was written for the share card, and the share card is about
  the house week, so recordDailyMarks looked at the house week and nothing
  else. That was right until a league could start a contest three months long.

  A quarter-long battle that shows one figure and no trajectory has exactly
  the problem the week had before it was given a shape: "up 12%" describes a
  run that climbed steadily and one that doubled and gave half of it back, and
  those are not the same three months. The difference cannot be worked out
  afterwards, because prices move on -- a day not recorded on the day is gone
  for good. So it has to start being recorded now.

  Nothing about the table changes. A portfolio belongs to exactly one cycle,
  so a battle's marks live under its own portfolios and cannot be confused
  with a week's, and every policy on the table is already written in terms of
  who owns the portfolio rather than what kind of contest it belongs to.

  What this migration adds is the question the recorder asks before doing any
  work: is there anything left to record today. That used to be answered in
  application code by looking at one portfolio of one cycle, which cannot
  answer it once there is more than one contest -- the week being written does
  not mean a league's battle was.
*/

-- ---------------------------------------------------------------------------
-- marks_needed_today
-- ---------------------------------------------------------------------------

create or replace function public.marks_needed_today(p_date date)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  /*
    True when some portfolio in some open contest has no close recorded for
    the given day.

    This is called on page renders, so it has to be far cheaper than the
    recording it might set off. It stops at the first row it finds: on a day
    already written it is an index probe that fails to match and returns, and
    on a day not yet written it matches almost immediately.
  */
  select exists (
    select 1
    from public.portfolios p
    join public.weekly_cycles c on c.id = p.cycle_id
    where c.status = 'open'
      and not exists (
        select 1
        from public.portfolio_marks m
        where m.portfolio_id = p.id
          and m.on_date = p_date
      )
  );
$$;

comment on function public.marks_needed_today(date) is
  'Whether any portfolio in any open contest still needs today''s close recorded.';

revoke all on function public.marks_needed_today(date) from public, anon, authenticated;
grant execute on function public.marks_needed_today(date) to service_role;

/*
  No index is added. The join above walks portfolios by cycle_id, which
  portfolios_cycle_idx has covered since 0002, and looks each one up in
  portfolio_marks by its primary key. Both sides are already indexed for
  exactly this shape of question.
*/
