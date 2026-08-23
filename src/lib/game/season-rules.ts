/*
  The two thresholds a season is judged by, on their own.

  They live apart from `seasons.ts` because they are the only part of a season
  anything outside the server needs. That file is `server-only` — it holds an
  admin Supabase client — so a client component naming one of these constants
  used to drag the whole thing into the browser bundle, and the build refused
  it. Nothing about a threshold requires a database, so nothing about reading
  one should require the module that has one.

  `seasons.ts` re-exports both, so every existing import still resolves and
  there is exactly one definition of each.
*/

/** How many weeks of a quarter somebody has to play to be ranked in it. */
export const MIN_WEEKS_TO_RANK = 3;

/** And how many make them a season regular, whoever they finished above. */
export const WEEKS_FOR_REGULAR = 8;
