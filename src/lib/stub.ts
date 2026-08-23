import "server-only";

/*
  A player, invented, with a week already in progress.

  Every room in this app is behind a sign-in, so the one thing nobody could
  ever watch was the thing players complain about: what a room does in the
  moment after a tap. This is what tests/instant drives, and it is behind an
  environment variable that no deployment sets -- the same shape as
  ARENA_UI_GALLERY.

  The portfolio matters as much as the session does, and that took longer to
  learn than it should have. With no holdings, getPortfolioView returns null,
  every room takes its empty branch, and Home's second wave -- the movers and
  the daily marks, which are asked for using what the player owns -- never
  runs at all. Three separate experiments passed against a room that was
  rendering about a tenth of itself.
*/
export const STUB = process.env.ARENA_STUB_SESSION === "1";

/*
  How slow to pretend the far end is.

  A stub that answers instantly makes every boundary resolve in the same tick,
  so a region that streams looks exactly like one that does not -- which is
  how a broken build once measured as fixed here.
*/
const LATENCY_MS = Number(process.env.ARENA_STUB_LATENCY_MS ?? "0");

export function pretendSlow(): Promise<void> {
  if (LATENCY_MS <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, LATENCY_MS));
}
