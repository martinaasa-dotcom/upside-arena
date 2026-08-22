import { beforeEach, describe, expect, it, vi } from "vitest";

/*
  The switch that decides whether pods run at all.

  It answers by counting every portfolio in the week, and it is asked on the
  way into Home and Trade. That makes it a fact about the whole game being
  re-counted once per room per player per visit, so the count is now shared
  for a few minutes at a time. These pin that sharing, and pin the two things
  it must not do: answer from a failed query, or keep last week's answer.
*/

const eq = vi.fn();

vi.mock("@/lib/env", () => ({ canWriteGame: true }));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({ select: () => ({ eq }) }),
  }),
}));

const { podsAreWorthRunning, PODS_MINIMUM, __resetPodGate } = await import(
  "@/lib/game/pods"
);

beforeEach(() => {
  __resetPodGate();
  eq.mockReset();
});

describe("podsAreWorthRunning", () => {
  it("says no while the game is too quiet to carry a pod", async () => {
    eq.mockResolvedValue({ count: PODS_MINIMUM - 1, error: null });
    expect(await podsAreWorthRunning("week-1")).toBe(false);
  });

  it("says yes once enough people are playing the week", async () => {
    eq.mockResolvedValue({ count: PODS_MINIMUM, error: null });
    expect(await podsAreWorthRunning("week-1")).toBe(true);
  });

  it("counts once for a week however many people ask", async () => {
    eq.mockResolvedValue({ count: 10, error: null });

    for (let i = 0; i < 5; i++) await podsAreWorthRunning("week-1");

    expect(eq).toHaveBeenCalledTimes(1);
  });

  it("counts again when the week changes", async () => {
    eq.mockResolvedValue({ count: 10, error: null });

    await podsAreWorthRunning("week-1");
    await podsAreWorthRunning("week-2");

    expect(eq).toHaveBeenCalledTimes(2);
  });

  it("does not remember an answer it never got", async () => {
    eq.mockResolvedValue({ count: null, error: new Error("query failed") });
    expect(await podsAreWorthRunning("week-1")).toBe(false);

    // A broken query must not switch pods off for everyone until it expires.
    eq.mockResolvedValue({ count: PODS_MINIMUM, error: null });
    expect(await podsAreWorthRunning("week-1")).toBe(true);
  });

  it("keeps the answer it already had when a later count fails", async () => {
    eq.mockResolvedValue({ count: PODS_MINIMUM, error: null });
    expect(await podsAreWorthRunning("week-1")).toBe(true);

    __resetPodGate();
    eq.mockResolvedValue({ count: PODS_MINIMUM, error: null });
    await podsAreWorthRunning("week-1");

    eq.mockResolvedValue({ count: null, error: new Error("query failed") });
    // Still inside the window, so the good answer stands and nothing is asked.
    expect(await podsAreWorthRunning("week-1")).toBe(true);
  });
});
