/*
  Putting a field in order.

  Seven places did this, all with the same expression and none of them with a
  tie-break: sort on the return, take the index, call it the rank. That is
  right until two people finish level, and then it is silently arbitrary --
  V8's sort is stable, so a tie keeps the order the rows arrived in, and the
  order rows arrive in is whatever Postgres felt like for that particular
  query.

  Which is not a rare case. Everybody who never trades finishes at exactly
  their starting balance, so in a league of six where three people were busy
  that week, three of them are tied at precisely 0.0000%. The room reads them
  in one order and the job that sends "you finished fifth of six" reads them
  in another, and one person is told a placing the table does not show.

  A review pass has already caught one version of this -- a notification that
  ranked a different field from the room it linked to. That was fixed at the
  call site. This is the same bug's other half, fixed where it cannot come
  back.
*/

export type Ranked = {
  userId: string;
  returnPercent: number;
};

/**
 * Best first, ties broken so that every screen agrees.
 *
 * The tie-break is the user id, which is arbitrary and is meant to be. It is
 * not a claim that one of two level players did better; it is the guarantee
 * that whatever order they are shown in, they are shown in it everywhere.
 * Anything meaningful enough to feel fair -- alphabetical, who traded first --
 * would need a field that is not on every one of these call sites, and a
 * tie-break that is only sometimes available is not a tie-break.
 */
export function compareResults(a: Ranked, b: Ranked): number {
  if (b.returnPercent !== a.returnPercent) return b.returnPercent - a.returnPercent;
  if (a.userId === b.userId) return 0;
  return a.userId < b.userId ? -1 : 1;
}

/** The same, as a new array, for the callers that were not mutating anyway. */
export function byResult<T extends Ranked>(rows: readonly T[]): T[] {
  return [...rows].sort(compareResults);
}
