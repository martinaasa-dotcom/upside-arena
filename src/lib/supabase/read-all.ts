import "server-only";

/*
  Reading a whole answer, however long it is.

  PostgREST does not return every row it matched. It returns at most
  db-max-rows, which a Supabase project is set to 1,000 by default, and it
  applies that silently: no error, no flag, just a shorter list. Every read in
  this app was written as though that were not true.

  Most of them were fixed by asking the database to count instead of counting
  here, which is better than paging because it makes the answer small. This is
  for the handful where the rows genuinely are the answer: a league's record
  needs one row per member per settled week to work out who beat whom, and no
  aggregate replaces that grid.

  The page size is deliberately below the default cap rather than at it. A
  loop that asks for exactly as many rows as it is allowed cannot tell a full
  page from a truncated one.
*/

const PAGE = 500;

/*
  Enough pages for any real answer, and a stop.

  Without a ceiling a misbehaving range would spin forever inside a page
  render. Half a million rows is far past anything this app asks for, so
  reaching it means something is wrong with the query rather than with the
  limit.
*/
const MAX_PAGES = 1000;

type Page<T> = { data: T[] | null; error: unknown };
type Ranged<T> = { range: (from: number, to: number) => PromiseLike<Page<T>> };

/**
 * Every row a query matches, fetched a page at a time.
 *
 * Takes the query builder rather than the promise, because each page is a
 * separate request and the builder is what can be given a different range.
 * Supabase's builders are single-use once awaited, so the caller passes a
 * function that makes a fresh one.
 *
 * An error on any page returns what has been read so far rather than
 * throwing, matching how every caller already treats a failed read: the room
 * draws with less rather than not at all.
 */
export async function readAll<T>(build: () => Ranged<T>): Promise<T[]> {
  const rows: T[] = [];

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const from = page * PAGE;
    const { data, error } = await build().range(from, from + PAGE - 1);

    if (error) break;

    const batch = data ?? [];
    rows.push(...batch);

    // A short page is the last page. A full one might not be.
    if (batch.length < PAGE) break;
  }

  return rows;
}
