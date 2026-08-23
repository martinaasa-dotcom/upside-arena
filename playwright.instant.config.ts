import { defineConfig, devices } from "@playwright/test";

/*
  The probe that watches a room arrive.

  Separate from playwright.config.ts because it needs the opposite of what
  that one needs. The main suite drives a signed-out app and asserts that
  every room is locked; this one needs a player already inside, and gets one
  from ARENA_STUB_SESSION -- which switches off the very lock the other suite
  is there to check. The two cannot share a server.

  ARENA_STUB_LATENCY_MS is the other half, and the half that took two tries to
  understand. A stub that answers instantly makes every boundary resolve in
  the same tick, so a room with a hole in it looks exactly like a room without
  one, and the broken version measured as fixed. What a player complains about
  is latency. So the probe has some.
*/
const PORT = 3600;
const baseURL = `http://127.0.0.1:${PORT}`;

const launchOptions = process.env.PLAYWRIGHT_CHROMIUM_PATH
  ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
  : {};

export default defineConfig({
  testDir: "./tests/instant",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  reporter: process.env.CI ? "github" : "list",
  /*
    Longer than the default, because the first render of a populated room
    fills every cache from cold and the upstreams here are placeholders that
    have to time out before the page can finish. What is measured is the
    navigation after that, which takes milliseconds.
  */
  timeout: 120_000,
  use: { baseURL, trace: "on-first-retry" },
  projects: [{ name: "desktop", use: { ...devices["Desktop Chrome"], launchOptions } }],
  webServer: {
    command: `npm run build && npx next start --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      NODE_USE_ENV_PROXY: "1",
      /*
        Enough for a project to count as configured, so the real code paths
        run. Nothing here talks to the host below; the game engine answers
        nothing and the rooms draw their empty state, which is all this probe
        needs. What it measures is when the room appears, not what is in it.
      */
      // A closed local port, refused instantly. See scripts/prerender-check.mjs.
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:1",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "placeholder-anon-key-no-project-behind-it",
      NEXT_PUBLIC_SITE_URL: baseURL,
      SUPABASE_SERVICE_ROLE_KEY: "placeholder-service-role-key",

      ARENA_STUB_SESSION: "1",
      // Comfortably longer than a frame, so a hole cannot hide in one.
      ARENA_STUB_LATENCY_MS: "400",
    },
  },
});
