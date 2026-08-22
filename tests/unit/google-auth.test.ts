import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  decideCallback,
  readStateCookie,
  sameState,
  stateFor,
} from "@/lib/auth/google-state";

/*
  The Google handshake Arena runs itself.

  These guard the parts that decide who somebody is. The state check is the
  only thing standing between a stranger's authorization code and your
  session, so it gets the most attention here.
*/

async function load(env: Record<string, string> = {}) {
  vi.resetModules();
  vi.stubEnv("GOOGLE_CLIENT_ID", env.GOOGLE_CLIENT_ID ?? "");
  vi.stubEnv("GOOGLE_CLIENT_SECRET", env.GOOGLE_CLIENT_SECRET ?? "");
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", env.SITE ?? "https://upsidearena.com");
  return import("@/lib/auth/google");
}

beforeEach(() => vi.unstubAllEnvs());

describe("whether Google sign-in is offered at all", () => {
  it("is off without credentials, so no button can appear that only fails", async () => {
    expect((await load()).googleConfigured).toBe(false);
  });

  it("needs both halves, not just the public one", async () => {
    expect((await load({ GOOGLE_CLIENT_ID: "id" })).googleConfigured).toBe(false);
    expect((await load({ GOOGLE_CLIENT_SECRET: "s" })).googleConfigured).toBe(false);
  });

  it("is on once it can actually complete a sign-in", async () => {
    const g = await load({ GOOGLE_CLIENT_ID: "id", GOOGLE_CLIENT_SECRET: "s" });
    expect(g.googleConfigured).toBe(true);
  });
});

describe("the state that ties a request to its answer", () => {
  it("never issues the same one twice", () => {
    const seen = new Set(
      Array.from({ length: 200 }, () => stateFor("/home").param)
    );
    expect(seen.size).toBe(200);
  });

  it("keeps the destination out of the url entirely", () => {
    // Google hands the state parameter back as an opaque string, and anything
    // read back out of it is input from whoever sent the browser here.
    const state = stateFor("/leagues/abc");
    expect(state.param).not.toContain("/leagues/abc");
    expect(state.cookie).toContain("/leagues/abc");
  });

  it("reads the destination back out of the cookie", () => {
    const state = stateFor("/trade");
    expect(readStateCookie(state.cookie)).toEqual({
      secret: state.param,
      next: "/trade",
    });
  });

  it("survives a destination containing the separator", () => {
    const state = stateFor("/w/a|b|c");
    expect(readStateCookie(state.cookie).next).toBe("/w/a|b|c");
    expect(readStateCookie(state.cookie).secret).toBe(state.param);
  });

  it("copes with a cookie that carries no destination", () => {
    expect(readStateCookie("justasecret")).toEqual({
      secret: "justasecret",
      next: "",
    });
  });
});

describe("comparing the state", () => {
  it("accepts only an exact match", () => {
    expect(sameState("abc123", "abc123")).toBe(true);
    expect(sameState("abc123", "abc124")).toBe(false);
  });

  it("refuses an empty state, which is what a missing cookie looks like", () => {
    // Without this, a callback arriving with no state and no cookie would
    // compare equal and be let through.
    expect(sameState("", "")).toBe(false);
  });

  it("refuses a different length rather than a prefix", () => {
    expect(sameState("abc", "abcdef")).toBe(false);
    expect(sameState("abcdef", "abc")).toBe(false);
  });
});

describe("where Google is sent and what it is asked for", () => {
  it("returns to Arena's own domain, which is the whole point", async () => {
    const g = await load({ GOOGLE_CLIENT_ID: "id", GOOGLE_CLIENT_SECRET: "s" });
    expect(g.googleRedirectUri()).toBe("https://upsidearena.com/auth/google/callback");

    const url = new URL(g.authorizeUrl("state123"));
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://upsidearena.com/auth/google/callback"
    );
    expect(url.host).toBe("accounts.google.com");
  });

  it("asks for a sign-in and nothing more", async () => {
    const g = await load({ GOOGLE_CLIENT_ID: "id", GOOGLE_CLIENT_SECRET: "s" });
    const url = new URL(g.authorizeUrl("state123"));
    expect(url.searchParams.get("scope")).toBe("openid email profile");
    expect(url.searchParams.get("response_type")).toBe("code");
  });

  it("asks which account rather than choosing one for somebody", async () => {
    const g = await load({ GOOGLE_CLIENT_ID: "id", GOOGLE_CLIENT_SECRET: "s" });
    const url = new URL(g.authorizeUrl("state123"));
    expect(url.searchParams.get("prompt")).toBe("select_account");
  });

  it("never puts the client secret in a url a browser will follow", async () => {
    const g = await load({
      GOOGLE_CLIENT_ID: "id",
      GOOGLE_CLIENT_SECRET: "the-secret",
    });
    expect(g.authorizeUrl("state123")).not.toContain("the-secret");
  });
});

describe("deciding what to do with a callback", () => {
  const good = stateFor("/leagues");

  it("lets a matching callback through, with the destination from the cookie", () => {
    expect(
      decideCallback({
        error: null,
        code: "abc",
        state: good.param,
        cookie: good.cookie,
      })
    ).toEqual({ kind: "proceed", code: "abc", next: "/leagues" });
  });

  it("treats a refusal as a refusal, not an error", () => {
    // Somebody who pressed cancel has not hit a fault and should not be shown
    // an error page for it.
    expect(
      decideCallback({
        error: "access_denied",
        code: null,
        state: null,
        cookie: null,
      })
    ).toEqual({ kind: "cancelled" });
  });

  it("refuses a code whose state was never issued to this browser", () => {
    // The whole point of the state. Without this, an authorization code from
    // somebody else's sign-in could be spent on this session.
    const other = stateFor("/home");
    expect(
      decideCallback({
        error: null,
        code: "abc",
        state: other.param,
        cookie: good.cookie,
      })
    ).toEqual({ kind: "fail", reason: "state" });
  });

  it("refuses a callback from a browser holding no cookie", () => {
    expect(
      decideCallback({ error: null, code: "abc", state: good.param, cookie: null })
    ).toEqual({ kind: "fail", reason: "state" });
  });

  it("refuses a callback carrying no state at all", () => {
    // The case an empty-string comparison would have let through.
    expect(
      decideCallback({ error: null, code: "abc", state: "", cookie: "" })
    ).toEqual({ kind: "fail", reason: "state" });
    expect(
      decideCallback({ error: null, code: "abc", state: null, cookie: null })
    ).toEqual({ kind: "fail", reason: "state" });
  });

  it("checks the state before it cares about the code", () => {
    // Ordering matters: a bad-state request must be refused for that reason
    // rather than being reported as anything the code could influence.
    expect(
      decideCallback({ error: null, code: "abc", state: "wrong", cookie: good.cookie })
        .kind
    ).toBe("fail");
  });

  it("wants a code before it will proceed", () => {
    expect(
      decideCallback({ error: null, code: null, state: good.param, cookie: good.cookie })
    ).toEqual({ kind: "fail", reason: "missing-code" });
  });

  it("will not send somebody off the site, whatever the cookie says", () => {
    // The cookie is ours, but it is only as trustworthy as the last thing
    // that wrote it, and an open redirect is not worth the assumption.
    for (const hostile of [
      "//evil.example",
      "https://evil.example",
      "/\\evil.example",
    ]) {
      const state = stateFor(hostile);
      const decision = decideCallback({
        error: null,
        code: "abc",
        state: state.param,
        cookie: state.cookie,
      });
      expect(decision).toEqual({ kind: "proceed", code: "abc", next: "/home" });
    }
  });
});
