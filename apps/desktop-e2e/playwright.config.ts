import { defineConfig, devices } from '@playwright/test';

require('dotenv').config({
    path: __dirname + "/" + ".env"
});


/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    }
  ],
});
