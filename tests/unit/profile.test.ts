import { describe, expect, it } from "vitest";
import { isOnboarded } from "@/lib/profile";
import { needsTour, TOUR_VERSION } from "@/lib/tour";
import type { Profile } from "@/lib/types";

function profile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: "00000000-0000-0000-0000-000000000000",
    handle: "player_one",
    display_name: "Player One",
    avatar_url: null,
    age_confirmed_at: "2026-08-21T10:00:00Z",
    rating: 1000,
    weeks_played: 0,
    best_week_return: null,
    career_alpha_avg: null,
    longest_streak: 0,
    equipped_title: null,
    equipped_flair: null,
    equipped_theme: null,
    onboarded_at: "2026-08-21T10:00:00Z",
    tour_version: 0,
    created_at: "2026-08-21T10:00:00Z",
    updated_at: "2026-08-21T10:00:00Z",
    ...overrides,
  };
}

describe("isOnboarded", () => {
  it("is true once a name and the age gate are both recorded", () => {
    expect(isOnboarded(profile())).toBe(true);
  });

  it("is false with no profile at all", () => {
    expect(isOnboarded(null)).toBe(false);
  });

  it("is false until the age gate is recorded", () => {
    expect(isOnboarded(profile({ age_confirmed_at: null }))).toBe(false);
  });

  it("is false until a display name is chosen", () => {
    expect(isOnboarded(profile({ display_name: null }))).toBe(false);
    expect(isOnboarded(profile({ onboarded_at: null }))).toBe(false);
  });
});

/*
  The walkthrough gate.

  Its whole reason for being a number rather than a boolean is the last case
  here: raising TOUR_VERSION has to put everybody who is behind it back in
  front of the walkthrough, including accounts that finished the previous one.
*/
describe("needsTour", () => {
  it("is false with no profile — that is a session still arriving", () => {
    expect(needsTour(null)).toBe(false);
  });

  it("is true for an account that has never finished one", () => {
    expect(needsTour(profile({ tour_version: 0 }))).toBe(true);
  });

  it("is false once the current one is finished", () => {
    expect(needsTour(profile({ tour_version: TOUR_VERSION }))).toBe(false);
  });

  it("is true again for anybody behind a newer one", () => {
    expect(needsTour(profile({ tour_version: TOUR_VERSION - 1 }))).toBe(true);
  });

  /*
    The case that keeps the walkthrough honest about docs/DEPLOY.md.

    Deploying does not apply migrations, so the app can run against a database
    with no `tour_version` column, and `readProfile` selects `*` -- the key is
    simply absent. Read as zero that would open the tour for everybody, fail
    to write on the same missing column, and open again on the next room, for
    every player, every page load. A feature that has not had its migration
    applied is supposed to be off, not stuck on.
  */
  it("shows nothing at all when the column is not there yet", () => {
    expect(needsTour(profile({ tour_version: undefined }))).toBe(false);
  });
});
