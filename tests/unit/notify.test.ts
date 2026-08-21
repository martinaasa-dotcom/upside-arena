import { describe, expect, it } from "vitest";
import {
  AWAKE_FROM,
  AWAKE_UNTIL,
  hourIn,
  isAwakeHour,
  isStreakReminderHour,
} from "@/lib/notify/timing";
import { emailHtml, emailText, escapeHtml } from "@/lib/notify/email-template";
import { decodeVapidKey } from "@/lib/notify/browser";

/*
  The rules about when and what, tested on their own.

  These are the parts most worth holding still. A message sent at three in the
  morning, or one that renders somebody's league name as markup, is not a
  smaller version of a good notification. It is the thing that gets the channel
  muted or the mail reported.
*/

/** A moment as it is on somebody's own clock, expressed in UTC. */
function utc(iso: string) {
  return new Date(iso);
}

describe("what hour it is where the player is", () => {
  it("reads the hour in the player's own timezone, not the server's", () => {
    // 18:00 UTC is early afternoon in New York and evening in Tallinn.
    const moment = utc("2026-08-19T18:00:00Z");
    expect(hourIn("America/New_York", moment)).toBe(14);
    expect(hourIn("Europe/Tallinn", moment)).toBe(21);
  });

  it("follows a timezone across the date line", () => {
    // Still Wednesday evening in New York, already Thursday in Auckland.
    const moment = utc("2026-08-19T22:00:00Z");
    expect(hourIn("America/New_York", moment)).toBe(18);
    expect(hourIn("Pacific/Auckland", moment)).toBe(10);
  });

  it("reports midnight as zero rather than twenty-four", () => {
    // The hour the whole quiet window exists to protect, so it has to be the
    // one that is definitely right.
    expect(hourIn("UTC", utc("2026-08-19T00:00:00Z"))).toBe(0);
    expect(hourIn("UTC", utc("2026-08-19T00:59:00Z"))).toBe(0);
  });

  it("treats an unreadable timezone as an ordinary afternoon", () => {
    // Never a reason to wake somebody, and never a reason to silence them for
    // good either.
    expect(hourIn("Not/APlace", utc("2026-08-19T03:00:00Z"))).toBe(12);
    expect(isAwakeHour("Not/APlace", utc("2026-08-19T03:00:00Z"))).toBe(true);
  });
});

describe("the quiet hours", () => {
  it("stays silent in the middle of the night where the player is", () => {
    // 06:00 UTC is two in the morning in New York.
    expect(isAwakeHour("America/New_York", utc("2026-08-19T06:00:00Z"))).toBe(false);
  });

  it("lets a message through in the middle of the player's day", () => {
    expect(isAwakeHour("America/New_York", utc("2026-08-19T18:00:00Z"))).toBe(true);
  });

  it("opens exactly at the first allowed hour and not a minute before", () => {
    // 11:59 UTC is 07:59 in New York during summer time, one minute early.
    expect(isAwakeHour("America/New_York", utc("2026-08-19T11:59:00Z"))).toBe(false);
    expect(isAwakeHour("America/New_York", utc("2026-08-19T12:00:00Z"))).toBe(true);
  });

  it("closes at the first disallowed hour", () => {
    // 20:59 then 21:00 in New York.
    expect(isAwakeHour("America/New_York", utc("2026-08-20T00:59:00Z"))).toBe(true);
    expect(isAwakeHour("America/New_York", utc("2026-08-20T01:00:00Z"))).toBe(false);
  });

  it("judges two people in different places by their own clocks", () => {
    // The same instant: mid-evening in Tallinn, mid-afternoon in New York.
    const moment = utc("2026-08-19T18:30:00Z");
    expect(isAwakeHour("Europe/Tallinn", moment)).toBe(false);
    expect(isAwakeHour("America/New_York", moment)).toBe(true);
  });

  it("keeps the window the right way round", () => {
    expect(AWAKE_FROM).toBeLessThan(AWAKE_UNTIL);
  });
});

describe("when a streak reminder is worth sending", () => {
  it("says nothing in the New York morning, when the day is still wide open", () => {
    // 14:00 UTC is ten in the morning in New York.
    expect(isStreakReminderHour(utc("2026-08-19T14:00:00Z"))).toBe(false);
  });

  it("sends in the New York afternoon", () => {
    // 18:00 UTC is two in the afternoon in New York.
    expect(isStreakReminderHour(utc("2026-08-19T18:00:00Z"))).toBe(true);
    // 22:00 UTC is six in the evening.
    expect(isStreakReminderHour(utc("2026-08-19T22:00:00Z"))).toBe(true);
  });

  it("stops before the New York evening is over", () => {
    // Midnight UTC is eight in the evening in New York, which is the first
    // hour that is too late to be asking anyone for anything.
    expect(isStreakReminderHour(utc("2026-08-20T00:00:00Z"))).toBe(false);
  });
});

describe("rendering an email", () => {
  const message = {
    title: "Bo Chen passed you",
    body: "Bo Chen is 1.7% ahead in Friday Club.",
    url: "/leagues/abc",
  };

  it("carries the message and a link to the right place", () => {
    const html = emailHtml(message, "https://upsidearena.com", "https://upsidearena.com/profile");
    expect(html).toContain("Bo Chen passed you");
    expect(html).toContain("https://upsidearena.com/leagues/abc");
  });

  it("always says how to stop receiving them", () => {
    const html = emailHtml(message, "https://upsidearena.com", "https://upsidearena.com/profile");
    const text = emailText(message, "https://upsidearena.com", "https://upsidearena.com/profile");
    expect(html).toContain("Turn these emails off");
    expect(text).toContain("Turn these emails off");
  });

  it("says it is play money in both versions", () => {
    // The disclaimer has to survive a mail client that strips the HTML part.
    const args = ["https://upsidearena.com", "https://upsidearena.com/profile"] as const;
    expect(emailHtml(message, ...args)).toContain("Not financial advice");
    expect(emailText(message, ...args)).toContain("Not financial advice");
  });

  it("cannot be made to carry markup by a player's own name", () => {
    // A display name and a league name both end up in here, and both are typed
    // by somebody.
    const hostile = {
      title: '<img src=x onerror="alert(1)">',
      body: "</td></tr></table><script>alert(1)</script>",
      url: "/home",
    };

    const html = emailHtml(hostile, "https://upsidearena.com", "https://upsidearena.com/profile");
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;script&gt;");
  });

  it("escapes a quote so it cannot break out of an attribute", () => {
    expect(escapeHtml('" onmouseover="x')).toBe("&quot; onmouseover=&quot;x");
    expect(escapeHtml("' onmouseover='x")).toBe("&#39; onmouseover=&#39;x");
  });

  it("escapes the ampersand first, so nothing is double-escaped into nonsense", () => {
    expect(escapeHtml("Ben & Jerry <script>")).toBe("Ben &amp; Jerry &lt;script&gt;");
  });
});

describe("the VAPID key the browser is handed", () => {
  it("decodes URL-safe base64 into the bytes a push service expects", () => {
    // The real public key for this deployment. A P-256 point is 65 bytes and
    // always starts with 0x04, so a mistake in the padding shows up here.
    const key =
      "BORtqyIav6qe2VOsurOQxSWcM3WxT_OITBUL3psWIw900NfVGGrNEeIkae4GZRxh52Hn390Zzv6aVeFfBAcGhNU";
    const bytes = decodeVapidKey(key);

    expect(bytes.length).toBe(65);
    expect(bytes[0]).toBe(0x04);
  });

  it("accepts the URL-safe alphabet, which plain base64 would reject", () => {
    // "-" and "_" stand in for "+" and "/", and there is no padding.
    const bytes = decodeVapidKey("-_-_");
    expect(Array.from(bytes)).toEqual([0xfb, 0xff, 0xbf]);
  });
});
