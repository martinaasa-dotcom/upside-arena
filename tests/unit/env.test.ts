import { afterEach, describe, expect, it, vi } from "vitest";

/*
  A blank environment variable is a normal way to leave a placeholder in a
  hosting dashboard. Passing one through to new URL() throws and fails the
  entire build, which is exactly what happened on the first deploy.
*/

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

async function siteUrl() {
  const mod = await import("@/lib/env");
  return mod.siteUrl();
}

describe("siteUrl", () => {
  it("uses an explicit site url", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://upsidearena.com");
    expect(await siteUrl()).toBe("https://upsidearena.com");
  });

  it("drops a trailing slash", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://upsidearena.com/");
    expect(await siteUrl()).toBe("https://upsidearena.com");
  });

  it("treats an empty value as unset rather than crashing", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    vi.stubEnv("VERCEL_URL", "");
    expect(await siteUrl()).toBe("http://localhost:3000");
  });

  it("treats a whitespace-only value as unset", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "   ");
    vi.stubEnv("VERCEL_URL", "");
    expect(await siteUrl()).toBe("http://localhost:3000");
  });

  it("falls back to the deployment url when no site url is set", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    vi.stubEnv("VERCEL_URL", "upside-arena.vercel.app");
    expect(await siteUrl()).toBe("https://upside-arena.vercel.app");
  });

  it("adds a scheme when the value has none", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "upsidearena.com");
    expect(await siteUrl()).toBe("https://upsidearena.com");
  });

  it("falls back rather than break every page on a malformed value", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://");
    vi.stubEnv("VERCEL_URL", "");
    expect(await siteUrl()).toBe("http://localhost:3000");
  });
});
