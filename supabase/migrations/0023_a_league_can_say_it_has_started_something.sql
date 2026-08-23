/*
  Being told your league has started a contest.

  A battle is the one thing in Arena that somebody else does to you. A league
  member picks a format and a length, and from that moment everybody in the
  league is in a contest -- with a portfolio, a place in a table, and a
  result coming whether they trade or not.

  The app said nothing about it. Somebody who opened Arena saw the battle on
  their home screen, and somebody who did not opened it a week later to find
  they had finished last of five in a contest they never knew about. That is
  the worst possible version of a shared game: the social event happened and
  you were absent from it without ever declining.

  ## Why this is its own switch

  A settled battle shares the week_result toggle, and the argument there was
  that "do you want to be told a contest you were in has been scored" is one
  question however it is asked. That argument does not carry here.

  The nearest existing switch is rival_alerts, and bundling would be a bad
  trade for the person it is meant to serve. Rival alerts fire while the
  market is open and can fire often; a battle starting happens when a league
  decides to do something, which is rare. Somebody who turns rival alerts off
  is turning off the noisy one, and taking the rare valuable one with it
  would be reading far more into that tap than they said.

  So: a fourth kind, a fourth column, default on, and named in the app for
  the thing it actually controls.
*/

-- ---------------------------------------------------------------------------
-- The setting
-- ---------------------------------------------------------------------------

alter table public.notification_settings
  add column if not exists league_activity boolean not null default true;

comment on column public.notification_settings.league_activity is
  'Whether to be told when a league this player is in starts a contest.';

-- ---------------------------------------------------------------------------
-- The kind
-- ---------------------------------------------------------------------------

alter table public.notifications
  drop constraint if exists notifications_kind_check;

alter table public.notifications
  add constraint notifications_kind_check
  check (kind in ('rival_passed', 'week_result', 'streak_reminder',
                  'battle_result', 'battle_started'));

-- ---------------------------------------------------------------------------
-- save_notification_settings
-- ---------------------------------------------------------------------------
-- The old signature is dropped rather than left beside the new one. Two
-- overloads differing by one trailing boolean is a call that resolves to
-- whichever Postgres prefers, and the one it prefers would silently stop
-- writing the new column.

drop function if exists public.save_notification_settings(
  uuid, boolean, boolean, boolean, boolean, boolean, text);

create or replace function public.save_notification_settings(
  p_user_id uuid,
  p_push_enabled boolean,
  p_email_enabled boolean,
  p_rival_alerts boolean,
  p_week_result boolean,
  p_streak_reminder boolean,
  p_league_activity boolean,
  p_timezone text default null
)
returns public.notification_settings
language plpgsql
security definer
set search_path = public
as $$
declare
  settings public.notification_settings;
begin
  insert into public.notification_settings (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  update public.notification_settings
  set push_enabled = coalesce(p_push_enabled, push_enabled),
      email_enabled = coalesce(p_email_enabled, email_enabled),
      rival_alerts = coalesce(p_rival_alerts, rival_alerts),
      week_result = coalesce(p_week_result, week_result),
      streak_reminder = coalesce(p_streak_reminder, streak_reminder),
      league_activity = coalesce(p_league_activity, league_activity),
      timezone = coalesce(nullif(btrim(coalesce(p_timezone, '')), ''), timezone)
  where user_id = p_user_id
  returning * into settings;

  return settings;
end;
$$;

revoke all on function public.save_notification_settings(
  uuid, boolean, boolean, boolean, boolean, boolean, boolean, text)
  from public, anon, authenticated;

grant execute on function public.save_notification_settings(
  uuid, boolean, boolean, boolean, boolean, boolean, boolean, text) to service_role;
