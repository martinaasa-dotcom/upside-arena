import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/*
  The privacy policy promises nothing is measured until you say yes. These
  tests hold the code to that promise, since a policy the app does not honour
  is worse than no policy.
*/

const KEY = "arena.consent.measurement";

function stubBrowser(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial));
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
    },
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  });
  vi.stubGlobal("CustomEvent", class {});
  return store;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("getConsent", () => {
  beforeEach(() => vi.resetModules());

  it("is unset before a choice is made", async () => {
    stubBrowser();
    const { getConsent } = await import("@/lib/consent");
    expect(getConsent()).toBe("unset");
  });

  it("reads a stored choice back", async () => {
    stubBrowser({ [KEY]: "granted" });
    const { getConsent } = await import("@/lib/consent");
    expect(getConsent()).toBe("granted");
  });

  it("treats an unrecognised stored value as no choice", async () => {
    stubBrowser({ [KEY]: "yes-please" });
    const { getConsent } = await import("@/lib/consent");
    expect(getConsent()).toBe("unset");
  });

  it("falls back to no consent when storage throws", async () => {
    vi.stubGlobal("window", {
      localStorage: {
        getItem: () => {
          throw new Error("blocked in private browsing");
        },
      },
    });
    const { getConsent } = await import("@/lib/consent");
    expect(getConsent()).toBe("unset");
  });
});

describe("track", () => {
  beforeEach(() => vi.resetModules());

  it("records nothing before a choice is made", async () => {
    stubBrowser();
    const { track } = await import("@/lib/analytics");
    track("signin_viewed");
    expect((globalThis.window as never as { __arenaAnalyticsQueue?: unknown[] })
      .__arenaAnalyticsQueue).toBeUndefined();
  });

  it("records nothing after consent is refused", async () => {
    stubBrowser({ [KEY]: "denied" });
    const { track } = await import("@/lib/analytics");
    track("signin_viewed");
    expect((globalThis.window as never as { __arenaAnalyticsQueue?: unknown[] })
      .__arenaAnalyticsQueue).toBeUndefined();
  });
});
