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
  onboarded_at: string | null;
  created_at: string;
  updated_at: string;
};
