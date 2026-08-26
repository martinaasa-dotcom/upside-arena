import { FORMATS, type Format, type FormatId } from "@/lib/game/formats";

/*
  Draft night: the arithmetic, with no database and no clock in it.

  A draft is the one thing in Arena that happens to several people at the same
  moment. Everything else here is somebody alone with a phone: a trade is
  yours, a lineup is yours, and a battle is five people playing the same week
  separately and comparing afterwards. Which is why the app never had to know
  whose turn it was.

  So the rules that decide whose turn it is live in one pure file. The room
  renders them, the database enforces them, and the tests can ask them
  questions without a Postgres. Every function here is total: given a seat
  count and a pick number it has an answer, because the alternative is a room
  that cannot say who is up.

  Two things are deliberately *not* here. Who is actually allowed to pick, and
  whether a name is still on the board, are both questions about rows, and a
  browser that answered either of them would be a browser deciding a contest.
  See 0031_draft_night.sql.
*/

/**
 * The fewest people a draft is worth holding for.
 *
 * Two. A draft of one is a shopping list, and the whole mechanic is that
 * somebody takes the name you wanted.
 */
export const MIN_SEATS = 2;

/**
 * The most.
 *
 * A league may have fifty people in it. A draft may not, and the number is
 * not about the database: at a minute a pick, twelve seats and three rounds
 * is already thirty-six minutes, and a thirteenth seat means waiting twelve
 * turns to pick twice. A draft night that outlasts the evening is a draft
 * night nobody finishes.
 */
export const MAX_SEATS = 12;

/** How many picks each person gets. What the room offers. */
export const ROUND_CHOICES = [2, 3, 4, 5] as const;

export const DEFAULT_ROUNDS = 3;

/**
 * How long a turn lasts.
 *
 * There is a clock because a draft has to survive somebody putting their
 * phone down, and a room of five where one person has wandered off is four
 * people who cannot do anything at all. It is generous on purpose: this is
 * not a reflex test, and the point of the evening is the argument before the
 * tap.
 */
export const PICK_SECONDS_CHOICES = [30, 60, 120] as const;

export const DEFAULT_PICK_SECONDS = 60;

/**
 * How often the room asks the server what has happened. Milliseconds.
 *
 * Here rather than beside the room's reads because the room is a client
 * component, and a value imported from the server module would pull the whole
 * of it, admin database client and all, into the browser bundle.
 *
 * Two seconds against a turn of thirty at the shortest: late by an amount
 * nobody can perceive, for one small indexed read. It is the number that makes
 * a socket unnecessary, so it belongs beside the clock it is paced against.
 */
export const POLL_MS = 2000;

export type PickSeconds = (typeof PICK_SECONDS_CHOICES)[number];

/** How the clock is said out loud, where a number of seconds would read oddly. */
export function pickClockLabel(seconds: number): string {
  if (seconds < 60) return `${seconds} seconds a pick`;
  if (seconds === 60) return "A minute a pick";
  return `${Math.round(seconds / 60)} minutes a pick`;
}

/*
  Which formats can be drafted, and why it is not all of them.

  A draft needs a board: a list of names everybody can see, that runs out as
  it is picked over. Half the formats in Arena are a *kind* of thing rather
  than a list ("any company or fund", "only funds"), and a board of every
  company in America is not a board, it is a search box. Three things break
  without a finite list: nobody can see what is left, the clock has nothing to
  pick for somebody who has walked off, and there is no way to tell a league
  of six that five rounds will not fit.

  It is derived rather than listed, so a format added with a hand-picked list
  is draftable the day it lands and one added as a type is not, without
  anybody having to remember this file exists.
*/
export function boardFor(format: Pick<Format, "universe">): readonly string[] | null {
  return format.universe.kind === "list" ? format.universe.symbols : null;
}

export function isDraftable(format: Pick<Format, "universe">): boolean {
  return boardFor(format) !== null;
}

export const DRAFTABLE_FORMATS = FORMATS.filter(isDraftable);

export function isDraftableFormatId(id: string): id is FormatId {
  return DRAFTABLE_FORMATS.some((format) => format.id === id);
}

/**
 * How many rounds a board of this size will carry for this many people.
 *
 * The board has to run out *after* the draft rather than during it: a room
 * that gets to the last pick and has nothing left to take is a room that
 * cannot finish, and there is no honest way to end one early. So the answer
 * is a floor, and the form is held to it before anybody sits down rather than
 * discovering it at pick nineteen.
 */
export function maxRounds(boardSize: number, seats: number): number {
  if (seats < MIN_SEATS) return 0;
  return Math.floor(boardSize / seats);
}

/** Whether this shape of draft fits on this board at all. */
export function draftFits(boardSize: number, seats: number, rounds: number): boolean {
  return (
    seats >= MIN_SEATS &&
    seats <= MAX_SEATS &&
    rounds >= 1 &&
    seats * rounds <= boardSize
  );
}

/** Every pick in the draft, in the order they happen. */
export function totalPicks(seats: number, rounds: number): number {
  return seats * rounds;
}

/**
 * Whose turn it is at a given pick, snake order.
 *
 * Odd rounds run down the seats and even ones run back up, so picking last in
 * the first round means picking first in the second. Straight repetition
 * would make seat one worth having and seat six worth nothing, and since the
 * seats are dealt at random that is a contest decided before anybody has
 * picked anything.
 *
 * Zero-based in both, because the pick number is an index into the whole
 * sequence and the seat is an index into the order.
 */
export function seatForPick(pickNumber: number, seats: number): number {
  if (seats <= 0) return 0;

  const round = Math.floor(pickNumber / seats);
  const withinRound = pickNumber % seats;

  return round % 2 === 0 ? withinRound : seats - 1 - withinRound;
}

/** Which round a pick belongs to, counting from one, for saying out loud. */
export function roundForPick(pickNumber: number, seats: number): number {
  if (seats <= 0) return 1;
  return Math.floor(pickNumber / seats) + 1;
}

/**
 * The whole running order, so the room can show what is coming.
 *
 * Seeing that you are up in two turns is most of what makes a draft watchable
 * for the people who are not currently picking, which is all but one of them
 * at any moment.
 */
export function pickOrder(seats: number, rounds: number): number[] {
  const order: number[] = [];
  for (let pick = 0; pick < totalPicks(seats, rounds); pick += 1) {
    order.push(seatForPick(pick, seats));
  }
  return order;
}

/**
 * How many turns until this seat is up again, or null if it never is.
 *
 * Counted from the pick that is live now, so zero means it is your turn.
 */
export function turnsUntil(
  seat: number,
  currentPick: number,
  seats: number,
  rounds: number
): number | null {
  const total = totalPicks(seats, rounds);
  for (let pick = currentPick; pick < total; pick += 1) {
    if (seatForPick(pick, seats) === seat) return pick - currentPick;
  }
  return null;
}

/**
 * What each pick is worth, in money.
 *
 * Everybody's picks are the same size, which is the difference between a
 * draft and a week of trading. You are not deciding how much to put behind a
 * name, you are deciding which names, and every one of yours carries the same
 * weight as every one of everybody else's. That is what makes the board the
 * whole game.
 *
 * Rounded down to the cent, and what the rounding leaves behind stays as
 * cash, so nobody is handed a fraction of a penny more than the person beside
 * them.
 */
export function budgetPerPick(startingBalance: number, rounds: number): number {
  if (rounds <= 0) return 0;
  return Math.floor((startingBalance / rounds) * 100) / 100;
}

/**
 * How many whole shares a pick's budget buys at the opening price.
 *
 * Whole shares, like everything else in Arena, so what the budget will not
 * divide into stays as cash rather than being rounded up into money nobody
 * had. A price of zero or worse buys nothing, and the caller says so rather
 * than filling at a number it invented.
 */
export function sharesForPick(budget: number, price: number): number {
  if (!Number.isFinite(price) || price <= 0) return 0;
  if (!Number.isFinite(budget) || budget <= 0) return 0;
  return Math.floor(budget / price);
}

/**
 * The next name the clock takes for somebody who is not there.
 *
 * The board's own order, first one still standing. Deterministic and visible:
 * the board is on screen in exactly this order all evening, so the pick the
 * clock makes is one anybody in the room could have called a second before it
 * happened. A random one would be the app inventing a decision nobody made,
 * and skipping the turn would quietly hand that person a smaller portfolio
 * than everybody else, which is worse than a pick they did not choose.
 */
export function autoPick(
  board: readonly string[],
  taken: Iterable<string>
): string | null {
  const gone = new Set(taken);
  for (const symbol of board) {
    if (!gone.has(symbol)) return symbol;
  }
  return null;
}

/** Where a draft has got to, in the words the room says it in. */
export function draftProgress(
  currentPick: number,
  seats: number,
  rounds: number
): string {
  const total = totalPicks(seats, rounds);
  if (currentPick >= total) return "All picked";
  return `Round ${roundForPick(currentPick, seats)} of ${rounds}, pick ${currentPick + 1} of ${total}`;
}
