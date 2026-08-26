import "server-only";

import { STARTING_BALANCE } from "@/lib/game";
import { canWriteGame } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessionOpen } from "@/lib/market/benchmark";
import { getQuotes, type Quote } from "@/lib/market/quotes";
import { lineupReady, nyDate } from "@/lib/market/session";
import {
  DEFAULT_FORMAT,
  formatById,
  type Format,
  type FormatId,
} from "@/lib/game/formats";
import {
  lengthById,
  runEndsOn,
  runStartsOn,
  type LengthId,
  type RunLength,
} from "@/lib/game/lengths";
import {
  MAX_SEATS,
  MIN_SEATS,
  autoPick,
  boardFor,
  budgetPerPick,
  draftFits,
  seatForPick,
  totalPicks,
  turnsUntil,
} from "@/lib/game/draft-order";
import type {
  DraftPickRow,
  DraftRow,
  DraftSeatRow,
  LeagueRow,
  WeeklyCycleRow,
} from "@/lib/supabase/database.types";
import { playerCache, playerChangedInBackground } from "@/lib/game/cache";

/*
  Draft night, server side.

  The room this serves is the only one in Arena that several people look at
  simultaneously and expect to change under them, so two things here are unlike
  everything else in this directory.

  **It is not cached the way rooms are.** playerCache carries a room's numbers
  in the App Shell so it arrives already holding them, which is right for a
  week that moves slowly and wrong for a board that changes every thirty
  seconds. What is cached is the part that does not move (who is in the league,
  what the board is called), and the state itself is read fresh on every poll.

  **It is polled rather than pushed.** There is no realtime anywhere in this
  app, and a draft does not need one: a turn is thirty seconds to two minutes,
  so a two second poll is late by an amount nobody can perceive, and it costs
  one small indexed read. Adding a socket layer for this one screen would mean
  a second way for the app to be connected, with its own reconnect story and
  its own failure mode, to save a second and a half.
*/

export type DraftStatus = DraftRow["status"];

/** One name on the board, and who has it. */
export type BoardName = {
  symbol: string;
  name: string | null;
  price: number | null;
  /** Null while it is still there to take. */
  takenBy: string | null;
  takenByName: string | null;
};

/** One turn in the running order. */
export type DraftTurn = {
  pickNumber: number;
  userId: string;
  name: string;
  isYou: boolean;
  round: number;
  symbol: string | null;
  /** True when nobody was there and the clock took it. */
  byClock: boolean;
  outcome: DraftPickRow["outcome"];
  shares: number | null;
  fillPrice: number | null;
  detail: string | null;
};

export type DraftSeat = {
  userId: string;
  name: string;
  seat: number | null;
  isYou: boolean;
};

/*
  What the room needs that does not change while it is open.

  Split from the state below because the board's company names cost a quote
  each and the state is asked for every two seconds. Fetching the names on
  every poll would be twenty-four quotes a person a second in a room of five,
  to redraw words that have not moved since the page loaded.
*/
export type DraftShell = {
  id: string;
  cycleId: string;
  leagueId: string;
  leagueName: string;
  format: Format;
  length: RunLength;
  rounds: number;
  pickSeconds: number;
  startsOn: string;
  endsOn: string;
  /** What one pick is worth, which is the same number the fill spends. */
  budget: number;
  board: { symbol: string; name: string | null; price: number | null }[];
  /** True for whoever opened it, who is the one who may start it. */
  isOpener: boolean;
};

/** Everything that moves. Read fresh on every poll. */
export type DraftState = {
  /*
    The server's clock, sent with every answer.

    The deadline is the server's and the countdown is the browser's, and the
    two are not the same clock: a phone a minute fast would draw a turn as
    already over while the server was still taking picks for it, and a phone a
    minute slow would show a minute left on a turn the clock had taken. The
    room offsets its countdown by the difference rather than trusting either.
  */
  now: number;
  status: DraftStatus;
  currentPick: number;
  totalPicks: number;
  /** When the live turn runs out, as epoch milliseconds. */
  deadline: number | null;
  seats: DraftSeat[];
  turns: DraftTurn[];
  taken: Record<string, { userId: string; name: string }>;
  /** Whose turn it is now, or null when there is not one. */
  onTheClock: DraftSeat | null;
  /** Zero when it is your turn, null when you have no turns left. */
  yourTurnsAway: number | null;
  youAreSeated: boolean;
};

export type DraftOutcome =
  | { ok: true }
  | { ok: false; error: string };

function num(value: string | null): number | null {
  if (value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Names for a set of players, from their profiles.
 *
 * A draft is the one room where somebody's name is on screen constantly rather
 * than in a table they scroll past, so a missing one reading "Player" is worth
 * avoiding: the sentence "Player is on the clock" is the app admitting it does
 * not know who is in the room.
 */
async function namesFor(
  admin: ReturnType<typeof createAdminClient>,
  userIds: string[]
): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  const wanted = [...new Set(userIds)];
  if (wanted.length === 0) return names;

  const { data } = await admin
    .from("profiles")
    .select("id, display_name, handle")
    .in("id", wanted);

  for (const row of (data ?? []) as {
    id: string;
    display_name: string | null;
    handle: string | null;
  }[]) {
    names.set(row.id, row.display_name || row.handle || "Somebody");
  }

  for (const id of wanted) if (!names.has(id)) names.set(id, "Somebody");

  return names;
}

/** A league's draft as the pages outside the room need it. */
export type LeagueDraft = {
  draft: DraftRow;
  /** How many people are in it, for the card. */
  seats: number;
  youAreSeated: boolean;
};

/**
 * The league's draft, if it has one.
 *
 * Cached, unlike the room's own state, and the difference is what each is for.
 * This answers "does this league have a draft and should I show a card", which
 * is a question the league page and the battle page ask on the way to
 * rendering, and an answer a minute old is the same answer. The room's live
 * state is getDraftState, which is not cached and is polled.
 *
 * Everything that changes it drops the tag: opening one, joining, starting,
 * picking, and the fill.
 */
export async function getLeagueDraft(
  userId: string,
  leagueId: string
): Promise<LeagueDraft | null> {
  "use cache";
  playerCache(userId);

  if (!canWriteGame) return null;

  const admin = createAdminClient();

  const { data: member } = await admin
    .from("league_members")
    .select("user_id")
    .eq("league_id", leagueId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!member) return null;

  const { data } = await admin
    .from("drafts")
    .select("*")
    .eq("league_id", leagueId)
    .maybeSingle();

  const draft = (data as DraftRow | null) ?? null;
  if (!draft) return null;

  const { data: seatRows } = await admin
    .from("draft_seats")
    .select("user_id")
    .eq("draft_id", draft.id);

  const seats = (seatRows ?? []) as { user_id: string }[];

  return {
    draft,
    seats: seats.length,
    youAreSeated: seats.some((row) => row.user_id === userId),
  };
}

/**
 * The half of the room that does not move.
 *
 * Every field here is fixed for the life of a draft: the rule book, the board,
 * the rounds, the clock, what a pick is worth. So it caches, and the room
 * arrives with its board already painted while only the live state streams,
 * which is the right way round: the state is replaced by the first poll two
 * seconds later anyway, and the board is what somebody is looking at.
 *
 * Membership is established from the roster rather than assumed from the url,
 * the same rule getBattleView follows: a draft id is not a secret, and
 * guessing one must not open somebody else's room.
 */
export async function getDraftShell(
  userId: string,
  draftId: string
): Promise<DraftShell | null> {
  "use cache";
  playerCache(userId);

  if (!canWriteGame) return null;

  const admin = createAdminClient();

  const { data: draftRow } = await admin
    .from("drafts")
    .select("*")
    .eq("id", draftId)
    .maybeSingle();

  const draft = draftRow as DraftRow | null;
  if (!draft) return null;

  const [{ data: member }, { data: leagueRow }, { data: cycleRow }] =
    await Promise.all([
      admin
        .from("league_members")
        .select("user_id")
        .eq("league_id", draft.league_id)
        .eq("user_id", userId)
        .maybeSingle(),
      admin
        .from("leagues")
        .select("id, name, icon")
        .eq("id", draft.league_id)
        .maybeSingle(),
      admin
        .from("weekly_cycles")
        .select("*")
        .eq("id", draft.cycle_id)
        .maybeSingle(),
    ]);

  if (!member || !leagueRow || !cycleRow) return null;

  const cycle = cycleRow as WeeklyCycleRow;
  const league = leagueRow as LeagueRow;
  const format = formatById(cycle.format);
  const board = boardFor(format) ?? [];

  /*
    Prices on the tiles, once.

    Not because anybody trades off them -- the fill is at Monday's open and
    Sunday's price is not it -- but because a board of twenty-four cashtags
    with nothing else on them asks somebody to know what ADI and ENTG are, and
    the argument this evening is supposed to be about companies.
  */
  const quotes: Record<string, Quote> = board.length ? await getQuotes([...board]) : {};

  return {
    id: draft.id,
    cycleId: draft.cycle_id,
    leagueId: draft.league_id,
    leagueName: league.name,
    format,
    length: lengthById(cycle.length),
    rounds: draft.rounds,
    pickSeconds: draft.pick_seconds,
    startsOn: cycle.monday,
    endsOn: cycle.ends_on,
    budget: budgetPerPick(num(cycle.starting_balance) ?? STARTING_BALANCE, draft.rounds),
    board: board.map((symbol) => ({
      symbol,
      name: quotes[symbol]?.name ?? null,
      price: quotes[symbol]?.price ?? null,
    })),
    isOpener: draft.created_by === userId,
  };
}

/**
 * Everything that moves, read fresh.
 *
 * Deliberately not cached at all. Every other read in this directory is, and
 * every other read in this directory answers a question whose answer is the
 * same for five minutes. This one is "whose turn is it", asked by five phones
 * in a room where somebody is waiting to tap.
 */
export async function getDraftState(
  userId: string,
  draftId: string
): Promise<DraftState | null> {
  if (!canWriteGame) return null;

  const admin = createAdminClient();

  const { data: draftRow } = await admin
    .from("drafts")
    .select("*")
    .eq("id", draftId)
    .maybeSingle();

  const draft = draftRow as DraftRow | null;
  if (!draft) return null;

  const { data: member } = await admin
    .from("league_members")
    .select("user_id")
    .eq("league_id", draft.league_id)
    .eq("user_id", userId)
    .maybeSingle();

  if (!member) return null;

  const [{ data: seatRows }, { data: pickRows }] = await Promise.all([
    admin.from("draft_seats").select("*").eq("draft_id", draftId).order("joined_at"),
    admin.from("draft_picks").select("*").eq("draft_id", draftId).order("pick_number"),
  ]);

  const seatData = (seatRows ?? []) as DraftSeatRow[];
  const pickData = (pickRows ?? []) as DraftPickRow[];

  const names = await namesFor(
    admin,
    [...seatData.map((s) => s.user_id), ...pickData.map((p) => p.user_id)]
  );

  const seats: DraftSeat[] = seatData
    .map((row) => ({
      userId: row.user_id,
      name: names.get(row.user_id) ?? "Somebody",
      seat: row.seat,
      isYou: row.user_id === userId,
    }))
    /*
      In seat order once they are dealt, and in the order people arrived
      before that. A lobby that reshuffles itself as people join reads as
      though something is being decided while you watch.
    */
    .sort((a, b) => (a.seat ?? Number.MAX_SAFE_INTEGER) - (b.seat ?? Number.MAX_SAFE_INTEGER));

  const seatCount = seatData.length;

  const turns: DraftTurn[] = pickData.map((row) => ({
    pickNumber: row.pick_number,
    userId: row.user_id,
    name: names.get(row.user_id) ?? "Somebody",
    isYou: row.user_id === userId,
    round: Math.floor(row.pick_number / Math.max(seatCount, 1)) + 1,
    symbol: row.symbol,
    byClock: row.by_clock,
    outcome: row.outcome,
    shares: num(row.shares),
    fillPrice: num(row.fill_price),
    detail: row.detail,
  }));

  const taken: DraftState["taken"] = {};
  for (const turn of turns) {
    if (turn.symbol) taken[turn.symbol] = { userId: turn.userId, name: turn.name };
  }

  const live = turns.find((turn) => turn.pickNumber === draft.current_pick) ?? null;
  const onTheClock: DraftSeat | null = live
    ? {
        userId: live.userId,
        name: live.name,
        seat: seatForPick(live.pickNumber, seatCount),
        isYou: live.isYou,
      }
    : null;

  const mySeat = seats.find((seat) => seat.isYou);

  return {
    now: Date.now(),
    status: draft.status,
    currentPick: draft.current_pick,
    totalPicks: totalPicks(seatCount, draft.rounds),
    deadline: draft.deadline ? new Date(draft.deadline).getTime() : null,
    seats,
    turns,
    taken,
    onTheClock: draft.status === "picking" ? onTheClock : null,
    yourTurnsAway:
      mySeat?.seat == null || draft.status !== "picking"
        ? null
        : turnsUntil(mySeat.seat, draft.current_pick, seatCount, draft.rounds),
    youAreSeated: Boolean(mySeat),
  };
}

/**
 * Opening a lobby, which creates the battle it will fill.
 *
 * The battle exists from this moment, so the league's one-contest-at-a-time
 * rule covers a draft in progress with no second mechanism. See 0031.
 */
export async function createDraft(
  userId: string,
  leagueId: string,
  formatId: FormatId,
  lengthId: LengthId,
  rounds: number,
  pickSeconds: number
): Promise<{ ok: true; draft: DraftRow } | { ok: false; error: string }> {
  if (!canWriteGame) return { ok: false, error: "Drafts are not switched on yet." };

  const format = formatById(formatId);
  const length = lengthById(lengthId);
  const board = boardFor(format);

  if (!board) {
    return {
      ok: false,
      error: "That rule book has no board to pick from. Choose one with a list of names.",
    };
  }

  const today = nyDate();
  const alwaysOpen = format.tradingHours === "always";
  const startsOn = runStartsOn(today, alwaysOpen);
  const endsOn = runEndsOn(today, length.id, alwaysOpen);

  /*
    The opening price, asked for now and usually null.

    A draft is a Sunday evening thing, so the session it fills at has not
    happened. set_benchmark_open fills it in from the first view once the
    market has opened, exactly as it does for a battle started at the weekend.
  */
  const benchmarkOpen = await getSessionOpen(format.benchmark, startsOn);

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("create_draft", {
    p_user_id: userId,
    p_league_id: leagueId,
    p_format: format.id,
    p_direction: format.direction,
    p_length: length.id,
    p_starts_on: startsOn,
    p_ends_on: endsOn,
    p_starting_balance: STARTING_BALANCE,
    p_benchmark_symbol: format.benchmark,
    p_benchmark_open: benchmarkOpen,
    p_rounds: rounds,
    p_pick_seconds: pickSeconds,
  });

  if (error) {
    if (error.message.includes("already has a battle")) {
      return {
        ok: false,
        error: "This league already has something running. Finish that one first.",
      };
    }
    if (error.message.includes("not a member")) {
      return { ok: false, error: "You are not in that league." };
    }
    return { ok: false, error: "We could not open that draft. Try again." };
  }

  return { ok: true, draft: data as unknown as DraftRow };
}

export async function joinDraft(userId: string, draftId: string): Promise<DraftOutcome> {
  if (!canWriteGame) return { ok: false, error: "Drafts are not switched on yet." };

  const admin = createAdminClient();
  const { error } = await admin.rpc("join_draft", {
    p_user_id: userId,
    p_draft_id: draftId,
    p_max_seats: MAX_SEATS,
  });

  if (error) {
    if (error.message.includes("already started")) {
      return { ok: false, error: "This draft has already started." };
    }
    if (error.message.includes("full")) {
      return { ok: false, error: `A draft holds ${MAX_SEATS} people, and this one is full.` };
    }
    if (error.message.includes("not a member")) {
      return { ok: false, error: "You are not in that league." };
    }
    return { ok: false, error: "We could not sit you down. Try again." };
  }

  return { ok: true };
}

export async function leaveDraft(userId: string, draftId: string): Promise<DraftOutcome> {
  if (!canWriteGame) return { ok: false, error: "Drafts are not switched on yet." };

  const admin = createAdminClient();
  const { error } = await admin.rpc("leave_draft", {
    p_user_id: userId,
    p_draft_id: draftId,
  });

  if (error) {
    if (error.message.includes("already started")) {
      return { ok: false, error: "This draft has already started, so the clock picks for you." };
    }
    if (error.message.includes("calls it off")) {
      return { ok: false, error: "You opened this one, so call it off rather than leaving it." };
    }
    return { ok: false, error: "We could not take you out of it. Try again." };
  }

  return { ok: true };
}

/**
 * Dealing the seats and starting the clock.
 *
 * The shuffle and the snake both happen here, and the running order goes into
 * the database as a row per turn. The alternative was to store a seat count
 * and work the order out on demand, which would put the snake arithmetic in
 * SQL as well as in draft-order.ts: two copies that are supposed to agree.
 */
export async function startDraft(
  userId: string,
  draftId: string
): Promise<DraftOutcome> {
  if (!canWriteGame) return { ok: false, error: "Drafts are not switched on yet." };

  const admin = createAdminClient();

  const { data: draftRow } = await admin
    .from("drafts")
    .select("*")
    .eq("id", draftId)
    .maybeSingle();

  const draft = draftRow as DraftRow | null;
  if (!draft) return { ok: false, error: "We could not find that draft." };

  const { data: cycleRow } = await admin
    .from("weekly_cycles")
    .select("format")
    .eq("id", draft.cycle_id)
    .maybeSingle();

  const format = formatById((cycleRow as { format: string } | null)?.format ?? DEFAULT_FORMAT);
  const board = boardFor(format);
  if (!board) return { ok: false, error: "That rule book has no board to pick from." };

  const { data: seatRows } = await admin
    .from("draft_seats")
    .select("user_id")
    .eq("draft_id", draftId);

  const seated = ((seatRows ?? []) as { user_id: string }[]).map((row) => row.user_id);

  if (seated.length < MIN_SEATS) {
    return {
      ok: false,
      error: `A draft needs at least ${MIN_SEATS} people. Get somebody else to join first.`,
    };
  }

  if (!draftFits(board.length, seated.length, draft.rounds)) {
    return {
      ok: false,
      error: `${format.name} has ${board.length} names on it, which will not carry ${seated.length} people picking ${draft.rounds} times.`,
    };
  }

  const order = shuffle(seated);

  const picks: string[] = [];
  for (let pick = 0; pick < totalPicks(order.length, draft.rounds); pick += 1) {
    picks.push(order[seatForPick(pick, order.length)]);
  }

  const { error } = await admin.rpc("start_draft", {
    p_user_id: userId,
    p_draft_id: draftId,
    p_seat_order: order,
    p_picks: picks,
    p_board_size: board.length,
    p_min_seats: MIN_SEATS,
    p_max_seats: MAX_SEATS,
    p_now: new Date().toISOString(),
  });

  if (error) {
    if (error.message.includes("only the person")) {
      return { ok: false, error: "Only whoever opened this draft can start it." };
    }
    if (error.message.includes("already started")) {
      return { ok: false, error: "This draft has already started." };
    }
    if (error.message.includes("board is too small")) {
      return {
        ok: false,
        error: `${format.name} does not have enough names for ${seated.length} people picking ${draft.rounds} times.`,
      };
    }
    return { ok: false, error: "We could not start it. Try again." };
  }

  return { ok: true };
}

/**
 * A fair shuffle, from the platform's own randomness.
 *
 * Fisher-Yates rather than a sort with a random comparator, which is not a
 * shuffle: a comparator that answers differently each time it is asked breaks
 * the ordering the sort assumes and leaves some arrangements far likelier than
 * others. Seat order decides who picks first, so it is worth getting right.
 */
function shuffle<T>(items: readonly T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor((crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32) * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Taking a name. */
export async function makePick(
  userId: string,
  draftId: string,
  symbol: string
): Promise<DraftOutcome> {
  if (!canWriteGame) return { ok: false, error: "Drafts are not switched on yet." };

  const wanted = symbol.trim().toUpperCase();
  if (!wanted) return { ok: false, error: "Pick a name." };

  const admin = createAdminClient();
  const { error } = await admin.rpc("make_pick", {
    p_user_id: userId,
    p_draft_id: draftId,
    p_symbol: wanted,
    p_now: new Date().toISOString(),
  });

  if (error) {
    /*
      The database's own sentence, passed through.

      "NVDA has gone. Somebody got there first." is the whole drama of a draft
      and it is written where the rule is enforced, so the room says exactly
      what happened rather than a translation of it.
    */
    if (error.message.includes("has gone")) {
      return { ok: false, error: error.message.replace(/^.*?:\s*/, "") };
    }
    if (error.message.includes("not your turn")) {
      return { ok: false, error: "It is not your turn." };
    }
    if (error.message.includes("not taking picks")) {
      return { ok: false, error: "This draft is not taking picks." };
    }
    return { ok: false, error: "We could not take that pick. Try again." };
  }

  return { ok: true };
}

/**
 * The turn nobody took.
 *
 * Called from any room whose poll notices the deadline has gone, which means
 * five phones firing it at once is the ordinary case rather than a race to
 * defend against: clock_pick checks the deadline itself under a lock, so the
 * first one moves the draft on and the rest find nothing to do.
 *
 * It reads the board here rather than in SQL because the board is a list in
 * formats.ts, and the name it takes is the first one still standing in that
 * list's own order. See autoPick.
 */
export async function runClock(draftId: string): Promise<boolean> {
  if (!canWriteGame) return false;

  const admin = createAdminClient();

  const { data: draftRow } = await admin
    .from("drafts")
    .select("*")
    .eq("id", draftId)
    .maybeSingle();

  const draft = draftRow as DraftRow | null;
  if (!draft || draft.status !== "picking") return false;
  if (!draft.deadline || new Date(draft.deadline).getTime() > Date.now()) return false;

  const { data: cycleRow } = await admin
    .from("weekly_cycles")
    .select("format")
    .eq("id", draft.cycle_id)
    .maybeSingle();

  const format = formatById((cycleRow as { format: string } | null)?.format ?? DEFAULT_FORMAT);
  const board = boardFor(format);
  if (!board) return false;

  const { data: pickRows } = await admin
    .from("draft_picks")
    .select("symbol")
    .eq("draft_id", draftId)
    .not("symbol", "is", null);

  const taken = ((pickRows ?? []) as { symbol: string }[]).map((row) => row.symbol);
  const choice = autoPick(board, taken);
  if (!choice) return false;

  const { data, error } = await admin.rpc("clock_pick", {
    p_draft_id: draftId,
    p_symbol: choice,
    p_now: new Date().toISOString(),
  });

  return !error && data != null;
}

export async function cancelDraft(
  userId: string,
  draftId: string
): Promise<DraftOutcome> {
  if (!canWriteGame) return { ok: false, error: "Drafts are not switched on yet." };

  const admin = createAdminClient();
  const { error } = await admin.rpc("cancel_draft", {
    p_user_id: userId,
    p_draft_id: draftId,
  });

  if (error) {
    if (error.message.includes("already been bought")) {
      return { ok: false, error: "This one has been bought. It is a battle now." };
    }
    if (error.message.includes("only the person")) {
      return { ok: false, error: "Only whoever opened this draft can call it off now." };
    }
    if (error.message.includes("only somebody in the draft")) {
      return { ok: false, error: "Only somebody sitting in this draft can call it off." };
    }
    return { ok: false, error: "We could not call it off. Try again." };
  }

  return { ok: true };
}

/**
 * Whether a draft is sitting picked and waiting for Monday's prices.
 *
 * Cheap and indexed, because it is asked on a page render and the fill it
 * might trigger is not. Same shape as hasLineupToFill, for the same reason.
 */
export async function draftAwaitingFill(
  userId: string,
  now = new Date()
): Promise<DraftRow | null> {
  if (!canWriteGame) return null;

  const admin = createAdminClient();

  const { data: seats } = await admin
    .from("draft_seats")
    .select("draft_id")
    .eq("user_id", userId);

  const ids = ((seats ?? []) as { draft_id: string }[]).map((row) => row.draft_id);
  if (ids.length === 0) return null;

  const { data } = await admin
    .from("drafts")
    .select("*")
    .in("id", ids)
    .eq("status", "picked")
    .limit(1);

  const draft = ((data ?? []) as DraftRow[])[0];
  if (!draft) return null;

  const { data: cycleRow } = await admin
    .from("weekly_cycles")
    .select("monday")
    .eq("id", draft.cycle_id)
    .maybeSingle();

  const monday = (cycleRow as { monday: string } | null)?.monday;
  if (!monday || !lineupReady(monday, now)) return null;

  return draft;
}

export type DraftFillResult = { filled: number; missed: number };

/**
 * Monday morning. Everything picked is bought at the opening price.
 *
 * One call for the whole draft rather than one per player, because the
 * fairness of it is that everybody fills at the same number and the cleanest
 * way to be sure of that is to spend one set of prices.
 *
 * Idempotent, so it does not matter which of five people opens the app first,
 * or how many of them do it at once.
 */
export async function fillDraft(
  draft: DraftRow,
  now = new Date()
): Promise<DraftFillResult> {
  const nothing: DraftFillResult = { filled: 0, missed: 0 };

  if (!canWriteGame) return nothing;
  if (draft.status !== "picked") return nothing;

  const admin = createAdminClient();

  const { data: cycleRow } = await admin
    .from("weekly_cycles")
    .select("*")
    .eq("id", draft.cycle_id)
    .maybeSingle();

  const cycle = cycleRow as WeeklyCycleRow | null;
  if (!cycle || cycle.status !== "open") return nothing;
  if (!lineupReady(cycle.monday, now)) return nothing;

  const { data: pickRows } = await admin
    .from("draft_picks")
    .select("symbol")
    .eq("draft_id", draft.id)
    .is("filled_at", null)
    .not("symbol", "is", null);

  const symbols = [
    ...new Set(((pickRows ?? []) as { symbol: string }[]).map((row) => row.symbol)),
  ];
  if (symbols.length === 0) return nothing;

  const opens = await Promise.all(
    symbols.map(async (symbol) => [symbol, await getSessionOpen(symbol, cycle.monday)] as const)
  );

  const prices: Record<string, number> = {};
  for (const [symbol, open] of opens) {
    if (open != null && open > 0) prices[symbol] = open;
  }

  /*
    Nothing priced at all is the provider having a bad morning rather than
    every company in the draft having been delisted overnight, so the picks
    are left unfilled and the next visit tries again. Handing the database an
    empty map would mark every one of them "no price" permanently.
  */
  if (Object.keys(prices).length === 0) return nothing;

  const { data, error } = await admin.rpc("fill_draft", {
    p_draft_id: draft.id,
    p_prices: prices,
    p_budget: budgetPerPick(
      num(cycle.starting_balance) ?? STARTING_BALANCE,
      draft.rounds
    ),
    p_today: nyDate(now),
  });

  if (error) return nothing;

  /*
    Everybody's cached reads, dropped.

    getLeagueDraft is cached and is what the league page and the battle page
    ask on the way to rendering, so without this a draft that has just been
    bought goes on offering "See the board" for up to a minute, on a page whose
    battle is now real and running.
  */
  const { data: seatRows } = await admin
    .from("draft_seats")
    .select("user_id")
    .eq("draft_id", draft.id);

  for (const row of (seatRows ?? []) as { user_id: string }[]) {
    playerChangedInBackground(row.user_id);
  }

  const rows = (data ?? []) as unknown as DraftPickRow[];

  return {
    filled: rows.filter((row) => row.outcome === "filled").length,
    missed: rows.filter((row) => row.outcome !== "filled").length,
  };
}

/**
 * Who is in a drafted battle, which is the people who sat down rather than the
 * whole league.
 *
 * A league of eight where five drafted must not rank the other three, and the
 * reason is not tidiness: in a week the market falls, holding nothing wins, so
 * three people who were never invited would take the top three places.
 */
export async function draftedRoster(cycleId: string): Promise<Set<string> | null> {
  if (!canWriteGame) return null;

  const admin = createAdminClient();

  const { data: draftRow } = await admin
    .from("drafts")
    .select("id")
    .eq("cycle_id", cycleId)
    .maybeSingle();

  const draft = draftRow as { id: string } | null;
  if (!draft) return null;

  const { data } = await admin
    .from("draft_seats")
    .select("user_id")
    .eq("draft_id", draft.id);

  return new Set(((data ?? []) as { user_id: string }[]).map((row) => row.user_id));
}

/** The one line a room says about a draft that has been bought. */
export async function draftFillSummary(
  userId: string,
  draftId: string
): Promise<{ filled: number; missed: number } | null> {
  "use cache";
  playerCache(userId);

  if (!canWriteGame) return null;

  const admin = createAdminClient();
  const { data } = await admin
    .from("draft_picks")
    .select("outcome")
    .eq("draft_id", draftId)
    .eq("user_id", userId)
    .not("filled_at", "is", null);

  const rows = (data ?? []) as { outcome: DraftPickRow["outcome"] }[];
  if (rows.length === 0) return null;

  return {
    filled: rows.filter((row) => row.outcome === "filled").length,
    missed: rows.filter((row) => row.outcome !== "filled").length,
  };
}
