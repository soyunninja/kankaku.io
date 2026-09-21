import { defineConfig, devices } from "@playwright/test";

// The suite runs against the BUILT site (`dist/`), never against a dev server:
// `astro dev` injects its toolbar and serves unoptimised output, so results
// differ. It cannot use `astro preview` either: Astro refuses to start a second
// server for the same project while one is running (the normal case while
// someone has `pnpm dev` open on 4321), and `reuseExistingServer` would
// silently test THAT server instead. So the tests build, then serve `dist/`
// with a tiny dependency-free static server on their own port.
const port = Number(process.env.SITE_TEST_PORT ?? 4399);
const origin = `http://localhost:${port}`;

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: {
    baseURL: origin,
    trace: "on-first-retry",
  },
  webServer: {
    command: `pnpm build && node scripts/serve-dist.mjs dist ${port}`,
    url: origin,
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
