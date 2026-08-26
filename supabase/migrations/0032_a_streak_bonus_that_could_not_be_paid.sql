-- Upside Arena: the one milestone that could never be paid.
--
-- `streak_bonus_amount` decides what a given milestone pays a given player,
-- and it decides it from a hash so that the answer is the same for ever and
-- cannot be re-rolled by refreshing the page. That part is right and is not
-- what changes here.
--
-- What changes is one cast. `hashtext` returns `integer`, and `abs()` has no
-- int32 answer for INT_MIN, so a player whose id and milestone happened to
-- hash to exactly -2147483648 did not get a smaller bonus: the function
-- raised `integer out of range`, and it raised inside `grant_streak_bonuses`,
-- which is called when somebody turns up. So that player's streak reward
-- failed rather than paid.
--
-- AND IT WOULD HAVE FAILED FOR EVER, which is the only reason this is worth a
-- migration at all. The odds are one in 4.29 billion per (player, milestone),
-- which on any real number of players is a thing that never happens. But the
-- function is `immutable` and deterministic by design, so the one pair it did
-- happen to would have hit it on every single attempt, permanently, with no
-- way for that player to get past it and nothing in the error naming a
-- milestone. A vanishingly rare bug that never clears is worse to own than a
-- common one that does.
--
-- The seed for the scale rehearsal carried the same idiom with a much larger
-- blast radius, and `supabase/scale/seed.sql` says what that cost.
-- `tests/unit/hash-overflow.test.ts` fails on `abs(hashtext(...))` anywhere
-- under `supabase/` without the cast, so neither can come back.
--
-- THIS MIGRATION IS THE REASON scripts/migration-state.py CAN NOW READ A
-- FUNCTION BODY. It creates nothing: same name, same two parameters, same row
-- in pg_proc, so on presence alone it read as applied against a project that
-- had never seen it, and `test-migration-state.sh` caught that. The checker
-- compares `md5(prosrc)` for a migration like this one instead.
--
-- Nothing a player has already been paid moves. In 64 bits `abs()` returns
-- the same value for every input except INT_MIN, `% 5` is unchanged, and a
-- bigint array subscript indexes the same element, so the only pair whose
-- answer differs is the one that used to have no answer.

create or replace function public.streak_bonus_amount(
  p_user_id uuid,
  p_day integer
)
returns integer
language sql
immutable
as $$
  select (array[25, 40, 60, 80, 120])[
           (abs(hashtext(p_user_id::text || ':streak:' || p_day::text)::bigint) % 5) + 1
         ]
         -- Grows slowly with the streak, so a month in is worth more than a
         -- week in without ever becoming the reason somebody is here.
         * (1 + p_day / 20)
$$;
