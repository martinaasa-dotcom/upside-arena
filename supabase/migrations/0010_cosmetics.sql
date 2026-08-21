-- Upside Arena, phase 8b: the rest of the cosmetics.
--
-- Section 2.5 names four kinds: avatar flair, profile themes, titles, and pod
-- badges. Phase 4 shipped titles and phase 8 shipped the machinery for buying
-- them, but the catalogue was left at two purchasable items while the coin
-- bundles went up to three thousand. Somebody buying the largest bundle could
-- spend a fifth of it. That is the sort of thing section 3 exists to prevent,
-- and it was not deliberate.
--
-- Pod badges are not here. They attach to public pods, which the plan defers
-- until there is volume to support them, and inventing them now would mean
-- inventing the thing they hang off.
--
-- The rule that does not move: none of this touches a score. A cosmetic is
-- what sits next to a name.

-- ---------------------------------------------------------------------------
-- More than titles
-- ---------------------------------------------------------------------------

alter table public.rewards drop constraint if exists rewards_kind_check;

alter table public.rewards
  add constraint rewards_kind_check check (kind in ('title', 'flair', 'theme'));

/*
  What the app should draw. A title needs nothing beyond its name, but flair
  and a theme are rendered, and the row has to say which one without the
  application holding a second copy of the catalogue.

  Deliberately a key rather than a colour or a class. Letting the database
  hand the browser arbitrary styling would be a way to smuggle a second
  palette past the brand rules, one row at a time.
*/
alter table public.rewards add column style_key text;

alter table public.rewards
  add constraint rewards_style_key_shape
  check (style_key is null or style_key ~ '^[a-z0-9_]{2,32}$');

-- Flair and themes are drawn, so they must say what to draw.
alter table public.rewards
  add constraint rewards_drawn_kinds_need_a_style
  check (kind = 'title' or style_key is not null);

-- ---------------------------------------------------------------------------
-- One slot per kind
-- ---------------------------------------------------------------------------
-- Wearing a title has never stopped anybody also having a picture frame, so
-- these are separate slots rather than one.

alter table public.profiles
  add column equipped_flair text references public.rewards (id) on delete set null,
  add column equipped_theme text references public.rewards (id) on delete set null;

-- ---------------------------------------------------------------------------
-- Everything worn has to be owned, and has to fit its slot
-- ---------------------------------------------------------------------------
-- Replaces the phase 4 trigger, which only guarded titles. Row level security
-- decides which rows are writable, not which values are allowed in them, so
-- without this a player could wear anything by writing to their own profile.

create or replace function public.protect_equipped_cosmetics()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  slot record;
begin
  for slot in
    select * from (values
      ('title', new.equipped_title, old.equipped_title),
      ('flair', new.equipped_flair, old.equipped_flair),
      ('theme', new.equipped_theme, old.equipped_theme)
    ) as s(kind, new_id, old_id)
  loop
    continue when slot.new_id is not distinct from slot.old_id;
    continue when slot.new_id is null;

    if not exists (
      select 1 from public.user_rewards
      where user_id = new.id and reward_id = slot.new_id
    ) then
      raise exception 'you have not earned that';
    end if;

    -- A title cannot be worn as a picture frame.
    if not exists (
      select 1 from public.rewards
      where id = slot.new_id and kind = slot.kind
    ) then
      raise exception 'that does not go there';
    end if;
  end loop;

  return new;
end;
$$;

drop trigger if exists profiles_protect_equipped_title on public.profiles;

create trigger profiles_protect_equipped_cosmetics
  before update on public.profiles
  for each row execute function public.protect_equipped_cosmetics();

-- ---------------------------------------------------------------------------
-- equip_cosmetic
-- ---------------------------------------------------------------------------
-- Replaces equip_title, which could only reach one slot.

create or replace function public.equip_cosmetic(
  p_user_id uuid,
  p_reward_id text,
  p_slot text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_slot not in ('title', 'flair', 'theme') then
    raise exception 'that does not go there';
  end if;

  if p_reward_id is not null then
    if not exists (
      select 1 from public.user_rewards
      where user_id = p_user_id and reward_id = p_reward_id
    ) then
      raise exception 'you have not earned that';
    end if;

    if not exists (
      select 1 from public.rewards where id = p_reward_id and kind = p_slot
    ) then
      raise exception 'that does not go there';
    end if;
  end if;

  -- Taking something off is always allowed, which is why null passes
  -- everything above.
  update public.profiles
  set equipped_title = case when p_slot = 'title' then p_reward_id else equipped_title end,
      equipped_flair = case when p_slot = 'flair' then p_reward_id else equipped_flair end,
      equipped_theme = case when p_slot = 'theme' then p_reward_id else equipped_theme end
  where id = p_user_id;
end;
$$;

drop function if exists public.equip_title(uuid, text);

-- ---------------------------------------------------------------------------
-- The catalogue
-- ---------------------------------------------------------------------------
-- Prices are set so that the whole shop comes to rather more than the largest
-- coin bundle. Nobody should be able to buy everything in one purchase, and
-- nobody should be left holding coins with nothing to spend them on.
--
-- Every name is plain language. None of them implies skill, standing, or that
-- the wearer did anything to get it beyond paying, because a bought cosmetic
-- that looks earned devalues the earned ones.

insert into public.rewards
  (id, kind, name, description, streak_required, sort_order, coin_price, plus_only, style_key)
values
  -- Titles, bought.
  ('title.regular', 'title', 'A regular',
   'Bought, not earned.', null, 140, 200, false, null),
  ('title.here_for_it', 'title', 'Here for it',
   'Bought, not earned.', null, 150, 200, false, null),
  ('title.slow_and_steady', 'title', 'Slow and steady',
   'Bought, not earned. Says nothing about your results.', null, 160, 300, false, null),
  ('title.no_notes', 'title', 'No notes',
   'Bought, not earned.', null, 170, 300, false, null),
  ('title.in_it_monday', 'title', 'In it by Monday',
   'Bought, not earned.', null, 180, 400, false, null),
  ('title.nothing_to_prove', 'title', 'Nothing to prove',
   'Bought, not earned.', null, 190, 400, false, null),

  -- Flair: a ring around your picture. Drawn from the marks and the accent,
  -- so nothing here introduces a colour the brand does not already have.
  ('flair.hairline', 'flair', 'Hairline',
   'A thin pale ring.', null, 210, 250, false, 'hairline'),
  ('flair.gold', 'flair', 'Warm ring',
   'The accent, around your picture.', null, 220, 350, false, 'gold'),
  ('flair.aqua', 'flair', 'Cut stone',
   'The aqua of the mark.', null, 230, 350, false, 'aqua'),
  ('flair.split', 'flair', 'Parted',
   'Warm on one side, cool on the other.', null, 240, 500, false, 'split'),
  ('flair.first_week', 'flair', 'First week',
   'For showing up five trading days in a row.', 5, 250, null, false, 'first_week'),

  -- Themes: how your own screens are lit. Variations inside the palette, not
  -- new colours, because the brand allows exactly one accent.
  ('theme.quiet', 'theme', 'Quiet',
   'The glow turned right down.', null, 310, 600, false, 'quiet'),
  ('theme.deep', 'theme', 'Deep',
   'More contrast, the glow pushed to the corner.', null, 320, 700, false, 'deep'),
  ('theme.even', 'theme', 'Even',
   'Lit from both sides instead of one.', null, 330, 700, false, 'even'),

  -- Members only. Never for sale, so a subscription buys a look rather than a
  -- shortcut to something other people earned.
  ('flair.member', 'flair', 'Member ring',
   'For Arena Plus members.', null, 260, null, true, 'member'),
  ('theme.house', 'theme', 'House',
   'For Arena Plus members.', null, 340, null, true, 'house');

-- ---------------------------------------------------------------------------
-- Only the service role equips anything
-- ---------------------------------------------------------------------------

revoke all on function public.equip_cosmetic(uuid, text, text) from public, anon, authenticated;
grant execute on function public.equip_cosmetic(uuid, text, text) to service_role;
