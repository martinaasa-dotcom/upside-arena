export type Profile = {
  id: string;
  handle: string | null;
  display_name: string | null;
  avatar_url: string | null;
  age_confirmed_at: string | null;
  rating: number;
  weeks_played: number;
  best_week_return: number | null;
  career_alpha_avg: number | null;
  longest_streak: number;
  equipped_title: string | null;
  equipped_flair: string | null;
  equipped_theme: string | null;
  onboarded_at: string | null;
  /**
   * Highest walkthrough version finished. 0 = never.
   *
   * Optional because a profile read from a database that has not had
   * migration `0024` applied has no such key at all -- `readProfile` selects
   * `*`. `needsTour` treats that as "no walkthrough" rather than as zero.
   */
  tour_version?: number;
  created_at: string;
  updated_at: string;
};
