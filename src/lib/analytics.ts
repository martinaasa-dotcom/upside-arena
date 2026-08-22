"use client";

import { track as sendToVendor } from "@vercel/analytics";
import { getConsent } from "@/lib/consent";

/*
  Product analytics, threaded through every phase rather than bolted on at the
  end. This is the single call site the app uses, so swapping the vendor later
  is a change here and nowhere else.

  What goes through here is only ever the shape of a session: which screens
  were opened, which buttons were pressed, whether a thing succeeded. Never a
  name, an email, a ticker somebody bought, a league name or a figure. Section
  2.8 wants the loop measured, and none of those are needed to measure it.

  The four numbers the plan actually asks for, D1/D7/D30 retention, streak
  survival, how full the leagues get and how often a week gets shared, are not
  computed from these events at all. They are computed in the database from
  data Arena already holds, which is both more accurate and keeps them working
  for the majority who decline measurement.
*/

export type AnalyticsEvent =
  // Getting in
  | "signin_viewed"
  | "age_gate_blocked"
  | "signin_link_requested"
  /* The address was one edit from a common domain and the person was asked. */
  | "signin_email_questioned"
  /* The address could not receive mail, so nothing was sent. */
  | "signin_email_refused"
  | "signin_google_started"
  | "signin_completed"
  | "onboarding_viewed"
  | "onboarding_completed"
  | "profile_updated"
  // Playing
  | "trade_screen_viewed"
  | "symbol_searched"
  | "trade_placed"
  | "trade_rejected"
  | "holdings_viewed"
  // Leagues
  | "league_create_started"
  | "league_created"
  | "league_join_started"
  | "league_joined"
  | "league_join_failed"
  | "league_invite_copied"
  | "league_left"
  | "standings_viewed"
  | "goal_declared"
  | "goal_withdrawn"
  // The long arc
  | "season_viewed"
  // Coming back
  | "streak_viewed"
  | "reward_earned"
  | "streak_bonus_paid"
  | "title_equipped"
  // Being told things
  | "notification_invite_shown"
  | "notification_invite_accepted"
  | "notification_invite_dismissed"
  | "push_enabled"
  | "push_blocked"
  | "push_disabled"
  | "notification_kind_toggled"
  // Sharing
  | "week_recap_viewed"
  | "share_started"
  | "share_completed"
  | "share_copied"
  | "share_image_opened"
  | "share_revoked"
  | "shared_card_viewed"
  | "shared_card_cta_clicked"
  // Paying for things
  | "plus_viewed"
  | "plus_checkout_started"
  | "plus_manage_opened"
  | "coins_checkout_started"
  | "cosmetic_purchased"
  | "cosmetic_purchase_refused"
  // The Upside Lab handoff
  | "lab_handoff_shown"
  | "lab_handoff_clicked"
  | "lab_handoff_dismissed"
  // Housekeeping
  | "install_prompt_shown"
  | "install_prompt_accepted"
  | "install_prompt_dismissed"
  | "consent_granted"
  | "consent_withdrawn"
  | "account_data_exported"
  | "account_deleted"
  | "signed_out";

/** What a vendor will accept. Anything richer is a person, not a measurement. */
export type EventProperties = Record<string, string | number | boolean | null>;

export function track(event: AnalyticsEvent, properties?: EventProperties) {
  // Measurement is optional and opt-in. No consent, no event, no exceptions.
  if (getConsent() !== "granted") return;

  if (process.env.NODE_ENV === "development") {
    console.debug("[analytics]", event, properties ?? {});
    return;
  }

  try {
    /*
      A no-op unless the vendor's script is on the page, and the component
      that loads it is itself behind consent. Two independent gates, because
      the consequence of getting this wrong is measuring somebody who said no.
    */
    sendToVendor(event, properties);
  } catch {
    // Measurement must never be able to break the thing being measured.
  }
}
