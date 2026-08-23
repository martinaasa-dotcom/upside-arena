import { beforeContestEnd } from "@/lib/market/session";

/*
  Who was in a league while a given contest was running.

  This question is asked in three rooms now -- the weekly winners, the
  head-to-head, and the reveal of what everybody held -- and the answer has to
  be the same in all of them or one panel contradicts another two inches
  further down the same page.

  It was written out twice before this existed, and the second copy simply did
  not ask it: a portfolio belongs to a person and a cycle rather than to a
  league, so somebody who played last week on their own and joined here on
  Monday had a book from a week they were not in this league for. Shown to
  people who were not playing against them, and ranked among them, which moved
  everybody else down one.

  A shared function rather than a comment saying the two agree, because two
  copies that are supposed to agree are two copies that will eventually not.
*/

export type RosterEntry = {
  userId: string;
  /** The timestamp on their league_members row. */
  joinedAt: string;
};

/**
 * The members who had joined in time to be part of a contest ending that day.
 *
 * In time, rather than on or before the date. A contest on market hours takes
 * its last trade at 16:00, so joining at nine that evening is not being in it
 * -- and comparing dates alone is wrong by an evening in one direction, while
 * reading the timestamp's first ten characters is UTC and wrong by an evening
 * in the other.
 *
 * allDay for the formats whose market never shuts, where the whole day counts.
 */
export function whoWasHere(
  roster: readonly RosterEntry[],
  endsOn: string,
  allDay = false
): Set<string> {
  const here = new Set<string>();

  for (const entry of roster) {
    const joined = new Date(entry.joinedAt);
    if (Number.isNaN(joined.getTime())) continue;
    if (beforeContestEnd(joined, endsOn, allDay)) here.add(entry.userId);
  }

  return here;
}
