import { beforeEach, describe, expect, it } from "vitest";
import {
  STATIC_SECURITY_HEADERS,
  buildContentSecurityPolicy,
  __resetContentSecurityPolicy,
} from "@/lib/security-headers";

/*
  The content security policy, which proxy.ts puts on every response.

  It is built once per process now rather than once per request, so these pin
  the two things that has to keep being true: the sentence is the same one it
  always was, and it is not frozen before the environment that shapes it has
  been read.
*/

beforeEach(() => {
  __resetContentSecurityPolicy();
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
});

describe("buildContentSecurityPolicy", () => {
  it("names the directives the app depends on", () => {
    const csp = buildContentSecurityPolicy();

    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("form-action 'self'");
    expect(csp).toContain("upgrade-insecure-requests");
    // The service worker is registered from a blob-free same-origin script,
    // and web push needs the worker source to allow it at all.
    expect(csp).toContain("worker-src 'self' blob:");
  });

  it("lets the browser reach the project this deployment is wired to", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://abcdef.supabase.co";

    const csp = buildContentSecurityPolicy();

    expect(csp).toContain("https://abcdef.supabase.co");
    expect(csp).toContain("wss://abcdef.supabase.co");
  });

  it("falls back to the wildcard when no project is configured", () => {
    expect(buildContentSecurityPolicy()).toContain("https://*.supabase.co");
  });

  it("is the same string every time it is asked for", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://abcdef.supabase.co";

    const first = buildContentSecurityPolicy();
    const second = buildContentSecurityPolicy();

    expect(second).toBe(first);
  });

  it("reads the environment when first asked, not when imported", () => {
    // The module was imported at the top of this file, before this line ran.
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://later.supabase.co";

    expect(buildContentSecurityPolicy()).toContain("https://later.supabase.co");
  });

  it("still ships the static headers alongside it", () => {
    const keys = STATIC_SECURITY_HEADERS.map((h) => h.key);

    expect(keys).toContain("X-Content-Type-Options");
    expect(keys).toContain("X-Frame-Options");
    expect(keys).toContain("Strict-Transport-Security");
    expect(keys).toContain("X-DNS-Prefetch-Control");
  });
});
