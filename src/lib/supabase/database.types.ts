/*
  Hand-written schema types.

  Kept in step with supabase/migrations by hand rather than generated, because
  generating needs project credentials that CI does not have. Only what the
  app actually reads or calls is described here; the database is the source of
  truth for everything else.

  Numeric columns arrive as strings. Postgres sends them that way so a value
  like 100000.15 cannot lose its last digit to a float, and the app converts
  where it needs a number.
*/

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export type ProfileRow = {
  id: string;
  handle: string | null;
  display_name: string | null;
  avatar_url: string | null;
  age_confirmed_at: string | null;
  rating: number;
  weeks_played: number;
  best_week_return: string | null;
  career_alpha_avg: string | null;
  longest_streak: number;
  equipped_title: string | null;
  onboarded_at: string | null;
  created_at: string;
  updated_at: string;
};

export type WeeklyCycleRow = {
  id: string;
  monday: string;
  status: "open" | "scoring" | "closed";
  benchmark_symbol: string;
  benchmark_open: string | null;
  benchmark_close: string | null;
  starting_balance: string;
  scoring_started_at: string | null;
  created_at: string;
  closed_at: string | null;
};

export type PortfolioRow = {
  id: string;
  user_id: string;
  cycle_id: string;
  starting_balance: string;
  cash: string;
  final_value: string | null;
  return_percent: string | null;
  benchmark_diff: string | null;
  created_at: string;
  updated_at: string;
};

export type HoldingRow = {
  id: string;
  portfolio_id: string;
  symbol: string;
  quantity: string;
  cost_basis: string;
  updated_at: string;
};

export type TradeRow = {
  id: string;
  portfolio_id: string;
  symbol: string;
  side: "buy" | "sell";
  quantity: string;
  price: string;
  value: string;
  executed_at: string;
};

export type StreakRow = {
  user_id: string;
  current_streak: number;
  longest_streak: number;
  last_active_date: string | null;
  freezes_available: number;
  freezes_used: number;
  freeze_granted_week: string | null;
  updated_at: string;
};

export type RewardRow = {
  id: string;
  kind: "title";
  name: string;
  description: string;
  streak_required: number | null;
  sort_order: number;
};

export type UserRewardRow = {
  id: string;
  user_id: string;
  reward_id: string;
  earned_at: string;
};

export type LeagueRow = {
  id: string;
  name: string;
  icon: string | null;
  owner_id: string;
  invite_code: string;
  max_members: number;
  created_at: string;
  updated_at: string;
};

export type LeagueMemberRow = {
  id: string;
  league_id: string;
  user_id: string;
  role: "owner" | "member";
  joined_at: string;
  /** Where they stood at the previous notification pass. Null until the first. */
  last_rank: number | null;
  last_rank_at: string | null;
};

export type PushSubscriptionRow = {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  user_agent: string | null;
  created_at: string;
  last_used_at: string | null;
  failures: number;
};

export type NotificationSettingsRow = {
  user_id: string;
  push_enabled: boolean;
  email_enabled: boolean;
  rival_alerts: boolean;
  week_result: boolean;
  streak_reminder: boolean;
  timezone: string;
  updated_at: string;
};

export type NotificationKind = "rival_passed" | "week_result" | "streak_reminder";

export type NotificationRow = {
  id: string;
  user_id: string;
  kind: NotificationKind;
  dedupe_key: string;
  title: string;
  body: string;
  url: string | null;
  channel: "push" | "email" | "none";
  created_at: string;
};

export type TermsAcceptanceRow = {
  id: string;
  user_id: string;
  document: "terms" | "privacy";
  version: string;
  accepted_at: string;
};

type Table<Row> = {
  Row: Row;
  Insert: Partial<Row>;
  Update: Partial<Row>;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      profiles: Table<ProfileRow>;
      terms_acceptances: Table<TermsAcceptanceRow>;
      weekly_cycles: Table<WeeklyCycleRow>;
      portfolios: Table<PortfolioRow>;
      holdings: Table<HoldingRow>;
      trades: Table<TradeRow>;
      leagues: Table<LeagueRow>;
      league_members: Table<LeagueMemberRow>;
      streaks: Table<StreakRow>;
      rewards: Table<RewardRow>;
      user_rewards: Table<UserRewardRow>;
      push_subscriptions: Table<PushSubscriptionRow>;
      notification_settings: Table<NotificationSettingsRow>;
      notifications: Table<NotificationRow>;
    };
    Views: Record<never, never>;
    Functions: {
      ensure_cycle: {
        Args: {
          p_monday: string;
          p_starting_balance: number;
          p_benchmark_open: number | null;
        };
        Returns: WeeklyCycleRow;
      };
      ensure_portfolio: {
        Args: { p_user_id: string; p_cycle_id: string };
        Returns: PortfolioRow;
      };
      execute_trade: {
        Args: {
          p_user_id: string;
          p_cycle_id: string;
          p_symbol: string;
          p_side: "buy" | "sell";
          p_quantity: number;
          p_price: number;
          p_max_per_minute: number;
          p_max_per_cycle: number;
        };
        Returns: TradeRow;
      };
      score_cycle: {
        Args: {
          p_cycle_id: string;
          p_closing_prices: Json;
          p_benchmark_close: number;
        };
        Returns: number;
      };
      delete_own_account: {
        Args: Record<never, never>;
        Returns: undefined;
      };
      due_cycles: {
        Args: { p_today: string };
        Returns: WeeklyCycleRow[];
      };
      claim_cycle_for_scoring: {
        Args: { p_cycle_id: string; p_stale_after: string };
        Returns: boolean;
      };
      release_cycle_claim: {
        Args: { p_cycle_id: string };
        Returns: undefined;
      };
      is_league_member: {
        Args: { p_league_id: string; p_user_id: string };
        Returns: boolean;
      };
      create_league: {
        Args: {
          p_user_id: string;
          p_name: string;
          p_icon: string | null;
          p_max_leagues: number;
          p_max_members: number;
        };
        Returns: LeagueRow;
      };
      join_league: {
        Args: { p_user_id: string; p_invite_code: string; p_max_leagues: number };
        Returns: LeagueRow;
      };
      leave_league: {
        Args: { p_user_id: string; p_league_id: string };
        Returns: undefined;
      };
      rename_league: {
        Args: {
          p_user_id: string;
          p_league_id: string;
          p_name: string;
          p_icon: string | null;
        };
        Returns: LeagueRow;
      };
      generate_invite_code: {
        Args: Record<never, never>;
        Returns: string;
      };
      record_activity: {
        Args: {
          p_user_id: string;
          p_today: string;
          p_missed_days: number;
          p_week_monday: string;
        };
        Returns: StreakRow;
      };
      grant_reward: {
        Args: { p_user_id: string; p_reward_id: string };
        Returns: boolean;
      };
      equip_title: {
        Args: { p_user_id: string; p_reward_id: string | null };
        Returns: undefined;
      };
      save_notification_settings: {
        Args: {
          p_user_id: string;
          p_push_enabled: boolean | null;
          p_email_enabled: boolean | null;
          p_rival_alerts: boolean | null;
          p_week_result: boolean | null;
          p_streak_reminder: boolean | null;
          p_timezone?: string | null;
        };
        Returns: NotificationSettingsRow;
      };
      save_push_subscription: {
        Args: {
          p_user_id: string;
          p_endpoint: string;
          p_p256dh: string;
          p_auth: string;
          p_user_agent?: string | null;
        };
        Returns: undefined;
      };
      delete_push_subscription: {
        Args: { p_endpoint: string };
        Returns: undefined;
      };
      record_notification: {
        Args: {
          p_user_id: string;
          p_kind: NotificationKind;
          p_dedupe_key: string;
          p_title: string;
          p_body: string;
          p_url: string | null;
          p_channel: "push" | "email" | "none";
          p_daily_cap?: number;
        };
        Returns: boolean;
      };
      update_member_ranks: {
        Args: { p_league_id: string; p_ranks: Record<string, number> };
        Returns: undefined;
      };
    };
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
};
