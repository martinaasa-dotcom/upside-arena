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

  COMPANY, in company.ts, holds who Arena is legally. This holds what it is.
*/

export const PRODUCT_NAME = "Upside Arena";

/**
 * The problem, before the product.
 *
 * Two type steps rather than two sentences on the page: the first line is
 * the thing that is true of everybody reading it, and the second is the
 * part that has always been missing. Naming the product first would be
 * naming it to somebody with no reason to care yet.
 *
 * Both lines are kept under 40 characters, which is what makes them one
 * line each at the desktop step (712px and 724px in a 768px column). The
 * first draft ran to 44 and measured 883px, so it wrapped, and `text-wrap:
 * balance` split it as "Everybody in the group" and "chat has a stock
 * pick.", which breaks the one phrase in it that has to stay whole. A
 * headline that fits is worth more than a headline that is exactly right
 * and hyphenated by the browser.
 */
export const HERO_PROBLEM = "Every group chat has a stock genius.";

export const HERO_TWIST = "Nobody ever finds out who was right.";

/**
 * What you do, and what comes back. Deliberately short: it says only what
 * the headline above it does not.
 */
export const HERO_LEDE =
  "Arena hands everyone the same play money on Monday and settles it at Friday's close. Real companies, real prices, and nothing real at stake.";

/** Under the sign-in card, and nowhere else in the hero. */
export const HERO_PRICE = "Free to play. No adverts, and no card.";

/**
 * How somebody gets from nothing to playing, which in Arena is a question
 * about people rather than about data. Lab asks you to paste what you own;
 * Arena asks you to find somebody to beat.
 */
export const WAYS_IN = [
  {
    icon: "users",
    title: "Make a league",
    detail:
      "Signing up makes you one and gives you a code. You do not have to set anything up.",
  },
  {
    icon: "share",
    title: "Send the code",
    detail:
      "Anybody with it is in. Nobody without it can find your league at all.",
  },
  {
    icon: "trade",
    title: "Pick on Monday",
    detail:
      "Everyone starts the week level with the same play money, so it is a fair race every time.",
  },
] as const;

/** The rooms that are not the week itself. Three, and all of them exist. */
export const MORE_ROOMS = [
  {
    icon: "battles",
    title: "Battles",
    detail:
      "A second contest running alongside the week with its own rule book: only chip makers, only coins, one company all week, or pick the losers instead. For a day, or for a year.",
  },
  {
    icon: "season",
    title: "Seasons",
    detail:
      "A quarter of weeks, ranked on how far ahead of the market you finished per week rather than on how much you made, so showing up the most is not a strategy.",
  },
  {
    icon: "weekend",
    title: "The weekend lineup",
    detail:
      "Pick over the weekend and it is bought at Monday's opening price. Everybody fills at the same price, so being awake at half past nine wins nothing.",
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
export const PRICE_HEADLINE = "Free to play, and the free game is the whole game.";

export const PRICE_NOTE =
  "There is a membership at around three euros a month. It buys decoration and a few conveniences, it cannot change a score, a ranking or what anybody is allowed to trade, and it never will.";

/**
 * Why it is safe to sign up, which for a game about share prices is mostly
 * about what Arena is not.
 *
 * Every line is checkable from inside the app or from the rules page. Do
 * not add one the product cannot back up.
 */
export const TRUST = [
  "The money is pretend. You cannot deposit, you cannot withdraw, and you cannot lose anything you had.",
  "Arena is not a broker and is never connected to an account you hold anywhere.",
  "Your league is private. Nobody can find it, and nobody joins it without the code.",
  "Take a copy of everything, or delete all of it, from your profile.",
] as const;

/**
 * The closing ask, so the last thing read is the thing to do.
 *
 * Two lines, the same shape as the hero, and for the same reason: one
 * sentence of this length lands in a 576px column as "Make a league. Send
 * the" and "code. Find out who was right.", because `text-wrap: balance`
 * had a tie and took the half that breaks a phrase. Written as two lines it
 * cannot break at all, and it closes the loop the headline opened: nobody
 * ever finds out who was right, so go and find out.
 */
export const CLOSING_ASK = "Make a league. Send the code.";

export const CLOSING_ASK_TWIST = "Then find out who was right.";
