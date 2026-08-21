import { describe, expect, it } from "vitest";
import { isOnboarded } from "@/lib/profile";
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
    onboarded_at: "2026-08-21T10:00:00Z",
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
