import { isFormatId, type FormatId } from "@/lib/game/formats";
import { isLengthId, type LengthId } from "@/lib/game/lengths";
import {
  cadencesFor,
  isCadenceId,
  type CadenceId,
} from "@/lib/game/cadence";

/*
  Named games, so a league does not have to assemble one from three knobs.

  A format is a rule book. A length is how long it runs. A cadence is when
  anybody may buy. Those three are the whole of what a battle is, and they
  are all on the custom side of the form. What this file adds is the thing
  somebody actually wants to start: a year of chips with one morning a month
  to change your mind, a week of whoever is making the sandwiches, funds
  bought on day one and left alone until Christmas.

  Each recipe is those three knobs, named. The well under the tiles reads
  the catalogues for the rule, so a sentence here cannot drift from the
  format it names. Tapping one fills the form. Mixing your own is still
  there, because a league that can only pick from twelve cards is a league
  that cannot invent the stupid game it actually wants.

  Pure, so the rules page can render the same list the form offers.
*/

export type Template = {
  id: TemplateId;
  name: string;
  tagline: string;
  icon: string;
  format: FormatId;
  length: LengthId;
  cadence: CadenceId;
};

export const TEMPLATES = [
  {
    id: "silicon_week" as const,
    name: "Silicon week",
    tagline: "Chips, five days, buy whenever you like.",
    icon: "\u{1F9E0}",
    format: "silicon" as const,
    length: "week" as const,
    cadence: "always" as const,
  },
  {
    id: "year_of_chips" as const,
    name: "A year of chips",
    tagline: "Twelve mornings to change your mind. The rest is living with Nvidia.",
    icon: "\u{1F9E0}",
    format: "silicon" as const,
    length: "year" as const,
    cadence: "monthly" as const,
  },
  {
    id: "the_nap" as const,
    name: "The nap",
    tagline: "Funds only, bought on day one, left alone until Christmas.",
    icon: "\u{1F4CA}",
    format: "index" as const,
    length: "year" as const,
    cadence: "once" as const,
  },
  {
    id: "one_name" as const,
    name: "One name, twelve chances",
    tagline: "One company at a time, for a year. Each month you may pick another.",
    icon: "\u{1F3AF}",
    format: "one_shot" as const,
    length: "year" as const,
    cadence: "monthly" as const,
  },
  {
    id: "lunch_money" as const,
    name: "Lunch money",
    tagline: "A week of whoever is making the sandwiches.",
    icon: "\u{1F354}",
    format: "lunch" as const,
    length: "week" as const,
    cadence: "always" as const,
  },
  {
    id: "dads_book" as const,
    name: "Dad's quarter",
    tagline: "The boring companies, for thirteen weeks, one morning a month to admit it.",
    icon: "\u{1F454}",
    format: "dad" as const,
    length: "quarter" as const,
    cadence: "monthly" as const,
  },
  {
    id: "the_garage" as const,
    name: "A month in the garage",
    tagline: "Cars, for four weeks, and you may only buy on a Monday.",
    icon: "\u{1F697}",
    format: "garage" as const,
    length: "month" as const,
    cadence: "mondays" as const,
  },
  {
    id: "vice_day" as const,
    name: "Smoke and drink, one day",
    tagline: "Tobacco, booze and betting. Settled tonight.",
    icon: "\u{1F378}",
    format: "vice" as const,
    length: "day" as const,
    cadence: "always" as const,
  },
  {
    id: "first_half_hour" as const,
    name: "The first half hour",
    tagline: "The loud sixteen, and you may only buy from 09:30 to 10:00.",
    icon: "\u{1F4A5}",
    format: "meme" as const,
    length: "week" as const,
    cadence: "bell" as const,
  },
  {
    id: "two_bets" as const,
    name: "Two bets",
    tagline: "Two companies. That is the whole book.",
    icon: "\u{1F91D}",
    format: "two_names" as const,
    length: "week" as const,
    cadence: "always" as const,
  },
  {
    id: "seven_til_christmas" as const,
    name: "Seven until Christmas",
    tagline: "The seven everybody already owns, four mornings a year to reweight them.",
    icon: "\u{1F48E}",
    format: "big_seven" as const,
    length: "year" as const,
    cadence: "quarterly" as const,
  },
  {
    id: "monday_club" as const,
    name: "Monday club",
    tagline: "Anything you like, for a month, and the book only changes on a Monday.",
    icon: "\u{1F4C5}",
    format: "open" as const,
    length: "month" as const,
    cadence: "mondays" as const,
  },
] as const;

export type TemplateId = (typeof TEMPLATES)[number]["id"];

export const DEFAULT_TEMPLATE: TemplateId = "silicon_week";

export function isTemplateId(value: string): value is TemplateId {
  return TEMPLATES.some((template) => template.id === value);
}

export function templateById(id: string | null | undefined) {
  return TEMPLATES.find((template) => template.id === id) ?? TEMPLATES[0];
}

/** A sprint versus a campaign, for grouping the tiles. */
export function templateHorizon(template: { length: LengthId }): "short" | "long" {
  return template.length === "day" ||
    template.length === "week" ||
    template.length === "fortnight"
    ? "short"
    : "long";
}

/** The recipe that is exactly these three knobs, if there is one. */
export function matchingTemplate(
  format: FormatId,
  length: LengthId,
  cadence: CadenceId
): TemplateId | null {
  const found = TEMPLATES.find(
    (template) =>
      template.format === format &&
      template.length === length &&
      template.cadence === cadence
  );
  return found?.id ?? null;
}

/**
 * A template whose format, length or cadence this build has since dropped
 * would start a contest that cannot be explained. The test holds the list
 * to the catalogues; this is the runtime half of the same check.
 */
export function templateIsPlayable(template: {
  format: string;
  length: string;
  cadence: string;
}): boolean {
  if (!isFormatId(template.format)) return false;
  if (!isLengthId(template.length)) return false;
  if (!isCadenceId(template.cadence)) return false;
  return cadencesFor(template.length).includes(template.cadence);
}
