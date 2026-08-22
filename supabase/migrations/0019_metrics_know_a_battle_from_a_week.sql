/*
  A battle is not a week, and the numbers page had started counting it as one.

  metrics_engagement reports weeks_scored, and it counted it like this:

      select count(*) from public.portfolios where return_percent is not null

  Before battles that was exactly right: every scored portfolio was a scored
  house week. It is now every scored portfolio in any contest, so a league
  running a one-day battle every day of a fortnight adds ten "weeks" to the
  only number on that page that says how much of this game has actually been
  played -- and the retention story is read off it.

  Nobody would notice. It moves in the right direction, it is plausible, and
  the number it inflates is the number used to decide whether the product is
  working. That is the whole reason this is worth its own migration rather
  than a line in the one that introduced battles.

  While the join is being added: how many battles have been run and how many
  lineups have been left are now worth reporting for themselves. Both are new
  and both are the kind of thing that is quietly used by nobody, which is the
  outcome you want to find out about in a fortnight rather than in a year.
*/

drop function if exists public.metrics_engagement(date);

create or replace function public.metrics_engagement(p_today date)
returns table (
  players integer,
  onboarded integer,
  traded integer,
  in_a_league integer,
  weeks_scored integer,
  weeks_shared integer,
  cards_live integer,
  active_today integer,
  active_this_week integer,
  -- Battles that have actually been settled, not battles that were started.
  -- A league that starts one and abandons it has told us nothing.
  battles_settled integer,
  -- And how many different leagues have tried one at all, which is the
  -- question "did anybody find this" rather than "did anybody stick with it".
  leagues_with_a_battle integer,
  -- Orders left at a weekend and actually bought on the Monday.
  lineups_filled integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    (select count(*) from public.profiles)::integer,
    (select count(*) from public.profiles where onboarded_at is not null)::integer,
    -- A trade hangs off a portfolio, not off a person, so this counts
    -- through one.
    (select count(distinct p.user_id)
       from public.trades t
       join public.portfolios p on p.id = t.portfolio_id)::integer,
    (select count(distinct user_id) from public.league_members)::integer,
    -- Of the house week. See the note at the top of this file.
    (select count(*)
       from public.portfolios p
       join public.weekly_cycles c on c.id = p.cycle_id
      where p.return_percent is not null
        and c.league_id is null)::integer,
    (select count(*) from public.share_cards)::integer,
    (select count(*) from public.share_cards where revoked_at is null)::integer,
    (select count(*) from public.daily_actives where on_date = p_today)::integer,
    (select count(distinct user_id) from public.daily_actives
      where on_date > p_today - 7)::integer,
    (select count(*) from public.weekly_cycles
      where league_id is not null and status = 'closed')::integer,
    (select count(distinct league_id) from public.weekly_cycles
      where league_id is not null)::integer,
    (select count(*) from public.lineup_orders where outcome = 'filled')::integer
$$;

revoke all on function public.metrics_engagement(date) from public, anon, authenticated;
grant execute on function public.metrics_engagement(date) to service_role;
