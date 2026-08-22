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
  equipped_flair: string | null;
  equipped_theme: string | null;
  onboarded_at: string | null;
  created_at: string;
  updated_at: string;
};

/*
  A contest. The house week everybody plays, or a league's own battle.

  They are the same row on purpose: a battle needs a portfolio per player,
  holdings, a trade log and a settlement, and every one of those already keys
  on a cycle. See supabase/migrations/0017_battles.sql for the whole argument.
*/
export type WeeklyCycleRow = {
  id: string;
  /** The day it starts. Still a Monday for the house week. */
  monday: string;
  /** The day it is settled at the close. The Monday plus four, for a week. */
  ends_on: string;
  status: "open" | "scoring" | "closed";
  /** A format id from src/lib/game/formats.ts. */
  format: string;
  /** Whether a position gains when the price rises or when it falls. */
  direction: "long" | "short";
  /** A length id from src/lib/game/lengths.ts. */
  length: string;
  /** The league whose battle this is, or null for the house week. */
  league_id: string | null;
  created_by: string | null;
  benchmark_symbol: string;
  benchmark_open: string | null;
  benchmark_close: string | null;
  starting_balance: string;
  scoring_started_at: string | null;
  season_id: string | null;
  created_at: string;
  closed_at: string | null;
};

/** What somebody said at the weekend they wanted to own on Monday. */
export type LineupOrderRow = {
  id: string;
  user_id: string;
  /** The Monday of the week this is for. */
  monday: string;
  symbol: string;
  quantity: string;
  created_at: string;
  /** When the week started and this ran, whatever came of it. */
  ran_at: string | null;
  outcome: "filled" | "no_price" | "not_enough_cash" | "refused" | null;
  fill_price: string | null;
  /** Why it did not run, in plain words. Shown to the player. */
  detail: string | null;
};

export type WeeklyGoalRow = {
  id: string;
  user_id: string;
  league_id: string;
  cycle_id: string;
  kind: "beat_market" | "finish_up" | "top_three" | "every_day";
  declared_at: string;
};

export type PodRow = {
  id: string;
  cycle_id: string;
  tier: "bronze" | "silver" | "gold" | "diamond";
  number: number;
  max_members: number;
  created_at: string;
  settled_at: string | null;
};

export type PodMemberRow = {
  id: string;
  pod_id: string;
  user_id: string;
  rating_at_placement: number;
  joined_at: string;
  final_rank: number | null;
  outcome: "promoted" | "held" | "relegated" | null;
  rating_change: number | null;
};

export type PodTierRow = {
  tier: string;
  min_rating: number;
  sort_order: number;
  name: string;
};

export type SeasonRow = {
  id: string;
  starts_on: string;
  ends_on: string;
  name: string;
  status: "open" | "closed";
  created_at: string;
  closed_at: string | null;
};

export type SeasonResultRow = {
  id: string;
  season_id: string;
  user_id: string;
  weeks_played: number;
  weeks_ahead: number;
  sum_return_percent: string;
  sum_benchmark_diff: string;
  best_week_return: string | null;
  final_rank: number | null;
  updated_at: string;
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

export type CosmeticSlot = "title" | "flair" | "theme";

export type RewardRow = {
  id: string;
  kind: CosmeticSlot;
  name: string;
  description: string;
  streak_required: number | null;
  sort_order: number;
  /** What it costs in coins, or null when it is earned rather than bought. */
  coin_price: number | null;
  plus_only: boolean;
  /*
    What the app draws for a flair or a theme. A key rather than a colour:
    letting the database hand the browser styling would be a way to smuggle a
    second palette past the brand rules one row at a time.
  */
  style_key: string | null;
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

/*
  battle_result is gated by the same setting as week_result -- see the note in
  0020 -- but it is its own kind, because the kind is what the daily cap counts
  and what /metrics reads.
*/
export type NotificationKind =
  | "rival_passed"
  | "week_result"
  | "streak_reminder"
  | "battle_result";

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

export type PortfolioMarkRow = {
  portfolio_id: string;
  on_date: string;
  value: string;
  return_percent: string;
  recorded_at: string;
};

export type ShareCardRow = {
  id: string;
  user_id: string;
  cycle_id: string;
  token: string;
  display_name: string;
  title_name: string | null;
  return_percent: string;
  benchmark_return: string | null;
  benchmark_diff: string | null;
  league_name: string | null;
  league_rank: number | null;
  league_size: number | null;
  streak_days: number;
  /** Daily returns in percent, oldest first. Empty when the week has no marks. */
  marks: number[];
  monday: string;
  created_at: string;
  revoked_at: string | null;
};

export type EntitlementRow = {
  user_id: string;
  product: string;
  source: "stripe" | "apple" | "google" | "gift";
  status: "active" | "past_due" | "cancelled" | "expired";
  external_ref: string | null;
  granted_at: string;
  expires_at: string | null;
  updated_at: string;
};

export type CoinBalanceRow = {
  user_id: string;
  balance: number;
  updated_at: string;
};

export type CoinLedgerRow = {
  id: string;
  user_id: string;
  delta: number;
  balance_after: number;
  reason: "purchase" | "spend" | "gift" | "refund";
  detail: string | null;
  idempotency_key: string;
  created_at: string;
};

export type BillingCustomerRow = {
  user_id: string;
  provider: string;
  customer_id: string;
  created_at: string;
};

/*
  Webhooks already handled. Never read through the client, and listed here
  only so the drift check can see it: a provider retries until acknowledged,
  and this table is what makes a retry harmless.
*/
export type BillingEventRow = {
  id: string;
  provider: string;
  kind: string;
  received_at: string;
};

export type LabHandoffRow = {
  user_id: string;
  token: string;
  shown_count: number;
  last_shown_at: string | null;
  dismissed_at: string | null;
  clicked_at: string | null;
  created_at: string;
};

export type DailyActiveRow = {
  user_id: string;
  on_date: string;
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
      weekly_goals: Table<WeeklyGoalRow>;
      lineup_orders: Table<LineupOrderRow>;
      pods: Table<PodRow>;
      pod_members: Table<PodMemberRow>;
      pod_tiers: Table<PodTierRow>;
      seasons: Table<SeasonRow>;
      season_results: Table<SeasonResultRow>;
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
      portfolio_marks: Table<PortfolioMarkRow>;
      share_cards: Table<ShareCardRow>;
      daily_actives: Table<DailyActiveRow>;
      entitlements: Table<EntitlementRow>;
      coin_balances: Table<CoinBalanceRow>;
      coin_ledger: Table<CoinLedgerRow>;
      billing_customers: Table<BillingCustomerRow>;
      billing_events: Table<BillingEventRow>;
      lab_handoffs: Table<LabHandoffRow>;
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
          /*
            Today in New York, so a contest that has not started or has
            already ended takes no trades. Supplied by the caller because the
            database has no opinion about New York, the same way due_cycles
            takes one.
          */
          p_today?: string | null;
        };
        Returns: TradeRow;
      };
      set_benchmark_open: {
        Args: { p_cycle_id: string; p_open: number };
        Returns: WeeklyCycleRow;
      };
      create_battle: {
        Args: {
          p_user_id: string;
          p_league_id: string;
          p_format: string;
          p_direction: "long" | "short";
          p_length: string;
          p_starts_on: string;
          p_ends_on: string;
          p_starting_balance: number;
          p_benchmark_symbol: string;
          p_benchmark_open?: number | null;
        };
        Returns: WeeklyCycleRow;
      };
      cancel_battle: {
        Args: { p_user_id: string; p_cycle_id: string };
        Returns: boolean;
      };
      queue_lineup_order: {
        Args: {
          p_user_id: string;
          p_monday: string;
          p_symbol: string;
          p_quantity: number;
          /** Worked out by the caller, which is what knows the time in New York. */
          p_locked: boolean;
          p_max_orders?: number;
        };
        Returns: LineupOrderRow;
      };
      clear_lineup_order: {
        Args: { p_user_id: string; p_order_id: string; p_locked: boolean };
        Returns: boolean;
      };
      fill_lineup: {
        Args: {
          p_user_id: string;
          p_cycle_id: string;
          p_monday: string;
          p_prices: Json;
          p_today?: string | null;
        };
        Returns: LineupOrderRow[];
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
      declare_goal: {
        Args: {
          p_user_id: string;
          p_league_id: string;
          p_cycle_id: string;
          p_kind: string;
        };
        Returns: WeeklyGoalRow;
      };
      tier_for_rating: {
        Args: { p_rating: number };
        Returns: string;
      };
      place_in_pod: {
        Args: { p_user_id: string; p_cycle_id: string; p_target_size?: number };
        Returns: PodRow;
      };
      settle_pod: {
        Args: {
          p_pod_id: string;
          p_move_fraction?: number;
          p_min_members?: number;
          p_rating_step?: number;
        };
        Returns: number;
      };
      due_pods: {
        Args: Record<never, never>;
        Returns: PodRow[];
      };
      season_for: {
        Args: { p_monday: string };
        Returns: SeasonRow;
      };
      record_season_week: {
        Args: {
          p_season_id: string;
          p_user_id: string;
          p_return_percent: number;
          p_benchmark_diff: number;
        };
        Returns: undefined;
      };
      close_season: {
        Args: {
          p_season_id: string;
          p_min_weeks?: number;
          p_regular_weeks?: number;
        };
        Returns: number;
      };
      grant_streak_bonuses: {
        Args: {
          p_user_id: string;
          p_streak: number;
          p_every?: number;
          p_drop_every?: number;
        };
        Returns: { day: number; coins: number; reward: string | null }[];
      };
      streak_bonus_amount: {
        Args: { p_user_id: string; p_day: number };
        Returns: number;
      };
      due_seasons: {
        Args: { p_today: string };
        Returns: SeasonRow[];
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
          /** How many freezes the weekly grant lifts them to. */
          p_weekly_freezes?: number;
        };
        Returns: StreakRow;
      };
      grant_reward: {
        Args: { p_user_id: string; p_reward_id: string };
        Returns: boolean;
      };
      equip_cosmetic: {
        Args: {
          p_user_id: string;
          p_reward_id: string | null;
          p_slot: CosmeticSlot;
        };
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
      record_portfolio_mark: {
        Args: {
          p_portfolio_id: string;
          p_date: string;
          p_value: number;
          p_return_percent: number;
        };
        Returns: boolean;
      };
      create_share_card: {
        Args: {
          p_user_id: string;
          p_cycle_id: string;
          p_monday: string;
          p_display_name: string;
          p_title_name: string | null;
          p_return_percent: number;
          p_benchmark_return: number | null;
          p_benchmark_diff: number | null;
          p_league_name: string | null;
          p_league_rank: number | null;
          p_league_size: number | null;
          p_streak_days: number;
          p_marks: number[];
        };
        Returns: ShareCardRow;
      };
      revoke_share_card: {
        Args: { p_user_id: string; p_card_id: string };
        Returns: boolean;
      };
      record_daily_active: {
        Args: { p_user_id: string; p_date: string };
        Returns: undefined;
      };
      metrics_retention: {
        Args: { p_today: string };
        Returns: { window_days: number; cohort: number; returned: number }[];
      };
      metrics_streaks: {
        Args: Record<never, never>;
        Returns: {
          players: number;
          alive: number;
          reached_five: number;
          reached_twenty: number;
          longest: number;
          freezes_spent: number;
        }[];
      };
      metrics_leagues: {
        Args: Record<never, never>;
        Returns: {
          leagues: number;
          alone: number;
          with_company: number;
          members: number;
          biggest: number;
        }[];
      };
      grant_entitlement: {
        Args: {
          p_user_id: string;
          p_product: string;
          p_source: "stripe" | "apple" | "google" | "gift";
          p_status: "active" | "past_due" | "cancelled" | "expired";
          p_external_ref?: string | null;
          p_expires_at?: string | null;
        };
        Returns: EntitlementRow;
      };
      has_entitlement: {
        Args: { p_user_id: string; p_product: string };
        Returns: boolean;
      };
      add_coins: {
        Args: {
          p_user_id: string;
          p_amount: number;
          p_reason: "purchase" | "gift" | "refund";
          p_idempotency_key: string;
          p_detail?: string | null;
        };
        Returns: number;
      };
      buy_reward: {
        Args: { p_user_id: string; p_reward_id: string };
        Returns: number;
      };
      link_billing_customer: {
        Args: { p_user_id: string; p_customer_id: string; p_provider?: string };
        Returns: undefined;
      };
      claim_billing_event: {
        Args: { p_id: string; p_kind: string; p_provider?: string };
        Returns: boolean;
      };
      record_handoff_shown: {
        Args: { p_user_id: string };
        Returns: LabHandoffRow;
      };
      record_handoff_outcome: {
        Args: { p_user_id: string; p_outcome: "clicked" | "dismissed" };
        Returns: undefined;
      };
      metrics_engagement: {
        Args: { p_today: string };
        Returns: {
          players: number;
          onboarded: number;
          traded: number;
          in_a_league: number;
          weeks_scored: number;
          weeks_shared: number;
          cards_live: number;
          active_today: number;
          active_this_week: number;
          battles_settled: number;
          leagues_with_a_battle: number;
          lineups_filled: number;
        }[];
      };
    };
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
};
