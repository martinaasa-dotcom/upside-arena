/*
  What Arena is, in the words the signed-out page says it in.

  The landing page is the only screen most people ever see, and it was
  carrying its own copy inline, which meant every sentence on it was a
  sentence nothing else could check. These are the ones that make a claim
  about the product: what it costs, what is at stake, what the rooms are.
  They live here so that the page, the metadata and the rules page cannot
  end up describing three slightly different games.

  Nothing aspirational goes in this file. Every line is something a person
  can click through and check within a minute of signing in, which matters
  more here than anywhere else in the app: this is read by somebody deciding
  whether the whole thing is worth an email address.

  Short on purpose, everywhere. The first draft of this page had three
  sentences under every heading and two more inside every card, and the
  effect of that much explaining is not thoroughness, it is doubt. A card
  gets one line. A section gets one line under its headline or none.

  COMPANY, in company.ts, holds who Arena is legally. This holds what it is.
*/

export const PRODUCT_NAME = "Upside Arena";

/**
 * The problem, before the product.
 *
 * Two type steps rather than two sentences: the first line is true of
 * everybody reading it, the second is the part that has always been
 * missing. Naming the product first would be naming it to somebody with no
 * reason to care yet.
 *
 * Both lines are deliberately very short, and that is what buys the type
 * size. A headline is the one place on a page where scale is the whole
 * argument, and every character spent is a point of size given up: at 26
 * and 19 characters these set at 64px on a desktop and still hold one line
 * each. An earlier draft ran to 44 characters, which forced 44px and still
 * wrapped, and `text-wrap: balance` then split it mid-phrase. Cut the
 * sentence, not the type.
 *
 * "Keeps score" is the hinge the whole page turns on. It is the thing
 * nobody does in a group chat, it is the thing Arena is, and the closing
 * ask at the bottom answers it in the same words.
 */
export const HERO_PROBLEM = "Everyone has a stock pick.";

export const HERO_TWIST = "Nobody keeps score.";

/**
 * What it is, for somebody who has never heard of it. One sentence saying
 * the category, one saying the mechanic, and nothing else. The headline
 * above has already done the wanting.
 */
export const HERO_LEDE =
  "A stock-picking game you play with friends. Play money on Monday, real prices all week, and a scoreboard on Friday.";

/** Under the sign-in card, and nowhere else in the hero. */
export const HERO_PRICE = "Free to play. No adverts, and no card.";

/**
 * How somebody gets from nothing to playing, which in Arena is a question
 * about people rather than about data. Lab asks you to paste what you own;
 * Arena asks you to find somebody to beat.
 *
 * Numbered on the page rather than given icons, because it is a sequence
 * and a sequence should be counted. Three steps, one line each.
 */
export const WAYS_IN = [
  {
    title: "Make a league",
    detail: "Signing up makes you one, with a code in it. There is nothing to set up.",
  },
  {
    title: "Send the code",
    detail: "Anybody with it is in. Nobody without it can find your league at all.",
  },
  {
    title: "Pick on Monday",
    detail: "Everyone starts the week level, so it is a fair race every time.",
  },
] as const;

/** The rooms that are not the week itself. Three, and all of them exist. */
export const MORE_ROOMS = [
  {
    icon: "battles",
    title: "Battles",
    detail:
      "The same market, a different rule book. Pick the companies, how long it runs, and when anybody may buy.",
  },
  {
    icon: "season",
    title: "Seasons",
    detail:
      "A quarter of weeks, ranked on how far ahead of the market you finished, so turning up the most is not a strategy.",
  },
  {
    icon: "weekend",
    title: "The weekend lineup",
    detail:
      "Pick on a Sunday and it is bought at Monday's open. Everybody fills at the same price.",
  },
] as const;

/**
 * What it costs, answered on the page rather than after signing up.
 *
 * The second sentence is the one that matters and it is the one every free
 * game buries. Arena Plus exists, it is real, and it is decoration. Saying
 * that in the same breath as the price costs nothing and is worth
 * something, because the thing a stranger is scanning for is the catch.
 *
 * Keep this in step with the Arena Plus room and section 9 of the plan. Two
 * different accounts of the same three euros is worse than either.
 */
export const PRICE_TITLE = "What it costs";

export const PRICE_HEADLINE = "Nothing. The free game is the whole game.";

export const PRICE_NOTE =
  "There is a membership at about three euros a month. It buys decoration and a little convenience. It cannot move a score, a ranking or what anybody is allowed to trade, and it never will.";

/**
 * Why it is safe to sign up, which for a game about share prices is mostly
 * a list of things Arena is not.
 *
 * Every line is checkable from inside the app or from the rules page. Do
 * not add one the product cannot back up.
 */
export const TRUST_TITLE = "Nothing real is at stake";

export const TRUST = [
  "The money is pretend. Nothing goes in, nothing comes out.",
  "Arena is not a broker, and it never touches an account you hold.",
  "Your league is private. Nobody joins it without the code.",
  "Take a copy of everything, or delete all of it, from your profile.",
] as const;

/**
 * The closing ask, so the last thing read is the thing to do.
 *
 * Two lines, the same shape as the hero, and it answers the hero in the
 * hero's own words: the page opens on nobody keeping score and closes on
 * Friday keeping it.
 */
export const CLOSING_ASK = "Make a league. Send the code.";

export const CLOSING_ASK_TWIST = "Friday keeps score.";
