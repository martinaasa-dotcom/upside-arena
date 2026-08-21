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
    };
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
};
