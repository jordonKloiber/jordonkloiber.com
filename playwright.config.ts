import { defineConfig, devices } from '@playwright/test';

// Tests always run against a real production build (`astro build` +
// `astro preview`), never `astro dev` — dev-mode HMR/overlay behavior
// isn't what ships, and console-error assertions need to see exactly
// what a visitor gets.
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4323',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // Port 4323, not Astro's default 4321 — `astro dev` defaults to 4321
    // too, and reuseExistingServer would silently attach to a stray dev
    // server instead of the production preview build tests need.
    //
    // ASTRO_PREVIEW_BACKGROUND + --ignore-lock: Astro 7 auto-detects an
    // AI-agent shell and forces `preview` into background/lock-file mode,
    // which then refuses to start if a *different* preview instance (e.g.
    // one Jordon started by hand) already holds the lock. This runs the
    // test preview in the foreground on its own port instead, alongside
    // whatever else is running, so tests never depend on dev/CLI state.
    command: 'npm run build && ASTRO_PREVIEW_BACKGROUND=1 npm run preview -- --port 4323 --ignore-lock',
    url: 'http://localhost:4323',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
