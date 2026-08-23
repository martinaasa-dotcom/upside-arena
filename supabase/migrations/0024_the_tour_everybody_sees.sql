/*
  The walkthrough, and the number that decides who has seen it.

  Arena explained itself in two places and neither reached the people who
  needed it most. `/how` is thorough and is signed out on purpose, which
  means it is a page you send somebody -- not a page anybody who signed in
  through Google has ever necessarily opened. The onboarding screen has
  three lines above the name field, and they are read by a person whose
  whole attention is on the name field.

  So there is a walkthrough now, and everybody sees it: the players who
  signed up this morning and the ones who have been here since the first
  week. That last part is the reason this is a version number rather than a
  boolean. `tour_seen boolean` answers "have they seen a tour", which stops
  being the useful question the first time the tour changes. An integer
  answers "which one", so raising TOUR_VERSION in src/lib/tour.ts shows the
  new one to everybody exactly once, and the schema never has to move again.

  Zero is nobody, which is where every existing row starts and is precisely
  the reset that was asked for. A new account starts at zero too: the
  trigger that makes a profile does not set this, so somebody signing up
  finishes the name step and walks straight into the tour.
*/

alter table public.profiles
  add column if not exists tour_version integer not null default 0;

comment on column public.profiles.tour_version is
  'Highest walkthrough version this player has finished. 0 = never. Compared against TOUR_VERSION in src/lib/tour.ts; raising that constant re-shows the tour to everybody once.';

-- Nothing to backfill. Every existing row defaults to 0, which is the point:
-- every account that already exists is due the new walkthrough.
