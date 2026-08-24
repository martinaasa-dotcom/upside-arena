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
    env: {
      /*
        Node's built-in fetch ignores HTTPS_PROXY unless told otherwise, which
        makes every server-side Supabase call fail inside a proxied sandbox.
        Harmless everywhere else.
      */
      NODE_USE_ENV_PROXY: "1",
      /*
        Mounts /gallery, which the clipping probe measures. Set here and in
        `npm run gallery`, and nowhere a deployment can read it, so the route
        404s in production.
      */
      ARENA_UI_GALLERY: "1",
      /*
        Enough for a project to count as configured, which is what makes
        `isSupabaseConfigured` true and so what makes the proxy in
        lib/supabase/session.ts actually run.

        Without them the proxy returns early, every signed-in route falls
        through to its own page-level guard, and that guard sends a visitor to
        `/` without the `next` it was headed for. The suite then fails two
        tests locally and passes them in CI, which set these and nothing else
        did: a check that only holds on one machine is not a check. They were
        in the CI job alone; they belong here, where the suite that depends on
        them lives.

        The same values CI uses, so the two agree. Nothing reaches the host: a
        signed-out visitor carries no token, so neither `getClaims` nor
        `getUser` touches the network, and the hostname matching the CSP's
        `https://*.supabase.co` keeps the browser honest about what it may
        talk to.
      */
      NEXT_PUBLIC_SUPABASE_URL: "https://placeholder.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "placeholder-anon-key-no-project-behind-it",
      NEXT_PUBLIC_SITE_URL: baseURL,
      /*
        Google is the only way in since the magic link went, so a signed-out
        suite with no client id configured is a suite where the sign-in button
        does not render and half the landing tests fail for a reason that has
        nothing to do with the change under review. The same trade the
        Supabase placeholders above make.

        They do not have to be real, and nothing here ever reaches Google:
        every test in this suite stops at the button. What they do is make
        `googleConfigured()` true, which is the only thing the page reads.
      */
      GOOGLE_CLIENT_ID: "placeholder.apps.googleusercontent.com",
      GOOGLE_CLIENT_SECRET: "placeholder-secret-no-client-behind-it",
    },
  },
});
