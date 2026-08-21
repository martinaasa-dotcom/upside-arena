import { defineConfig, devices } from "@playwright/test";

/*
  Some sandboxes ship a Chromium that does not match the version this
  Playwright pins. PLAYWRIGHT_CHROMIUM_PATH points at that build instead of
  downloading a second one.
*/
const launchOptions = process.env.PLAYWRIGHT_CHROMIUM_PATH
  ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
  : {};

const PORT = 3100;
const baseURL = `http://127.0.0.1:${PORT}`;

/*
  These cover what a signed-out visitor can reach, which runs without any
  Supabase credentials. Flows behind a session need a project configured;
  see docs/PHASE_1.md.
*/
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], launchOptions } },
    { name: "phone", use: { ...devices["Pixel 7"], launchOptions } },
  ],
  webServer: {
    command: `npm run build && npx next start --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
