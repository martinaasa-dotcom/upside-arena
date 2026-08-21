/*
  Who Arena is, legally.

  An online service established in the EU has to publish its provider details,
  and a privacy policy has to name the data controller. Both documents read
  these, so there is one place to correct them.

  Anything still wrapped in square brackets has not been confirmed. The legal
  pages detect that and show a notice, so an unfilled value cannot quietly ship
  as though it were real.
*/

export const COMPANY = {
  /** Registered company name, exactly as it appears in the register. */
  legalName: "[registered company name]",
  /** Estonian business register code. */
  registryCode: "[registry code]",
  /** Registered address. */
  address: "[registered address]",
  country: "Estonia",
  supportEmail: "app.support@upthink.ee",
  /** Where privacy requests go. May be the same address as support. */
  privacyEmail: "app.support@upthink.ee",
  productName: "Upside Arena",
  siblingProduct: "Upside Lab",
} as const;

/**
 * Countries Arena is offered in. The plan opens in North America to keep the
 * legal surface small. Add to this list only alongside the local rules that
 * come with each market.
 */
export const AVAILABLE_IN = ["the United States", "Canada"] as const;

/** Estonia's data protection authority, for the complaint route GDPR requires. */
export const SUPERVISORY_AUTHORITY = {
  name: "Andmekaitse Inspektsioon",
  englishName: "Estonian Data Protection Inspectorate",
  email: "info@aki.ee",
  url: "https://www.aki.ee",
} as const;

/** Estonia's consumer disputes body, for the out-of-court route consumers get. */
export const CONSUMER_DISPUTES = {
  name: "Tarbijavaidluste komisjon",
  englishName: "Consumer Disputes Committee",
  url: "https://ttja.ee",
} as const;

/**
 * The companies that handle player data on Arena's behalf. Naming them is a
 * transparency requirement, not a courtesy, so this list has to be kept
 * current as services are added.
 */
export const PROCESSORS = [
  {
    name: "Supabase",
    role: "Stores your account, your profile and your game history.",
    where: "European Union",
  },
  {
    name: "Vercel",
    role: "Serves the website and keeps short-lived server logs.",
    where: "European Union and the United States",
  },
] as const;

const PLACEHOLDER = /\[.+\]/;

/** True while any company detail is still unconfirmed. */
export const COMPANY_DETAILS_PENDING = [
  COMPANY.legalName,
  COMPANY.registryCode,
  COMPANY.address,
].some((value) => PLACEHOLDER.test(value));
