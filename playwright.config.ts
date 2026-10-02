import { defineConfig, devices } from '@playwright/test';

// @external tests hit third-party sites, so they stay out of the default
// run and only run under `npm run test:links`.
const external = !!process.env.EXTERNAL_LINKS;

// Tests always run against a real production build (`astro build` +
// `astro preview`), never `astro dev` — dev-mode HMR/overlay behavior
// isn't what ships, and console-error assertions need to see exactly
// what a visitor gets.
export default defineConfig({
  testDir: './tests',
  grep: external ? /@external/ : undefined,
  grepInvert: external ? undefined : /@external/,
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
    // Port 4323, not Astro's default 4321, so a running `astro dev` can't
    // collide. Always builds and starts fresh; never reuses a server.
    //
    // ASTRO_PREVIEW_BACKGROUND + --ignore-lock: Astro 7 forces `preview`
    // into background/lock-file mode in an AI-agent shell, and refuses to
    // start if another preview holds the lock. This runs in the foreground
    // on its own port instead.
    command: 'npm run build && ASTRO_PREVIEW_BACKGROUND=1 npm run preview -- --port 4323 --ignore-lock',
    url: 'http://localhost:4323',
    timeout: 120_000,
  },
});
