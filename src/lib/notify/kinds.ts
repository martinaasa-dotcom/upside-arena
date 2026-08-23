/*
  The things Arena will interrupt somebody for.

  Here rather than inside the settings screen because two surfaces describe
  them and both have to say the same thing: the switches on the profile, and
  the public rules page, which promises a stranger what signing up will cost
  them in attention before they hand over an email address.

  They were separate. The rules page said "four things" in prose that nothing
  checked, which is a promise that quietly stops being true the first time a
  fifth is added -- and a page that is wrong about what it will send you is
  worse than a page that never said.
*/

export const KINDS = [
  {
    key: "rivalAlerts" as const,
    label: "When somebody passes you",
    detail: "Only while the market is open, and only in a league you are in.",
  },
  {
    key: "weekResult" as const,
    /*
      One switch for two things, on purpose. A settled battle is the same
      question as a settled week -- do you want to be told a contest you were
      in has been scored -- and two toggles for one preference is one more
      decision than anybody wants to make about notifications.
    */
    label: "When a result comes in",
    detail:
      "Your week on Friday evening, and any battle your league finishes. Once each, whatever the result was.",
  },
  {
    key: "leagueActivity" as const,
    /*
      Its own switch rather than folded into the one above it. Being passed
      happens while the market is open and can happen often; a league
      starting a contest happens when a league decides to do something, which
      is rare. Somebody who turns the noisy one off is turning off the noisy
      one, and taking the rare one with it would read far more into that tap
      than they said.
    */
    label: "When your league starts a battle",
    detail:
      "You are in it either way, so this is the difference between playing it and finding out afterwards.",
  },
  {
    key: "streakReminder" as const,
    label: "When your streak needs today",
    detail: "Late afternoon, and only if you already have a streak going.",
  },
];
