/*
  A battle settles and nobody finds out.

  Everything else that happens to a player is told to them: a rival passes you,
  your week is scored, your streak is about to go. A league's battle -- which
  can run for a year -- finished in silence, and the only way to learn you had
  won one was to happen to open the room afterwards. A contest whose result
  nobody is told is a contest people play once.

  So notifications gain a kind. One row of a check constraint, and the reason
  it needs a migration at all rather than borrowing an existing kind: the kind
  is what the daily cap counts and what /metrics reads, and calling a settled
  battle a "week_result" would make both of those quietly wrong about what the
  app actually sends.

  What it deliberately does not gain is a setting of its own. Whether somebody
  wants to be told a contest they were in has been scored is the same question
  the week_result toggle already asks, and the honest thing is to answer it
  once. Somebody who turned that off is not asking to hear about this either.
*/

alter table public.notifications
  drop constraint notifications_kind_check;

alter table public.notifications
  add constraint notifications_kind_check check (
    kind in ('rival_passed', 'week_result', 'streak_reminder', 'battle_result')
  );

comment on column public.notifications.kind is
  'What happened. battle_result is a league contest being settled; it is gated by the same setting as week_result, because it is the same question.';
