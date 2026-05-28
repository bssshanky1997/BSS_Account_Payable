import path from 'path';
import dotenv from 'dotenv';
import { defineConfig } from '@playwright/test';
import { getEnvConfig } from './config/qa.env';

dotenv.config({
  path: path.resolve(__dirname, '.env'),
  override: true
});

const envConfig = getEnvConfig();

export default defineConfig({

  /* Test folder */
  testDir: './tests',

  /* Sequential execution for Jenkins stability */
  fullyParallel: false,

  /* Prevent accidental test.only in CI */
  forbidOnly: !!process.env.CI,

  /* Retry failed tests */
  retries: process.env.CI ? 2 : 1,

  /* Single worker for AP workflows */
  workers: 1,

  /* Global timeout */
  timeout: 120000,

  /* Expect timeout */
  expect: {
    timeout: 15000,
  },

  /* Reports */
  reporter: [
    ['html', {
      outputFolder: 'reports/html-report',
      open: 'never'
    }],
    ['list'],
    ['allure-playwright', {
      resultsDir: 'reports/allure-results'
    }],
  ],

  /* Global setup */
  globalSetup: './hooks/globalSetup.ts',

  /* Shared settings */
  use: {

    /* Headless for Jenkins */
    headless: false,

    /* Application URL */
    baseURL: envConfig.baseURL,

    /* Reuse login session */
    storageState: 'playwright/.auth/user.json',

    /* Better debugging */
    trace: 'retain-on-failure',

    /* Screenshots */
    screenshot: 'only-on-failure',

    /* Videos */
    video: 'retain-on-failure',

    /* Timeouts */
    actionTimeout: 30000,
    navigationTimeout: 60000,

    /* Use actual browser window size (works with --start-maximized) */
    viewport: null,

    /* Ignore SSL */
    ignoreHTTPSErrors: true,

    /* Slow execution slightly for Jenkins */
    launchOptions: {

      slowMo: 500,

      args: [
        '--start-maximized',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-sandbox',
        '--disable-setuid-sandbox'
      ]
    }
  },

  /* Test artifacts */
  outputDir: './test-results',

  /* Browser projects */
  projects: [
    {
      name: 'chromium',
    },
  ],
});