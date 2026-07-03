import path from 'path';
import dotenv from 'dotenv';
import { defineConfig } from '@playwright/test';

dotenv.config({
  path: path.resolve(__dirname, '.env'),
  override: true
});

const baseURL = String(process.env.BASE_URL || 'https://appqa.birchstreet.co').trim();
const isScheduledRun = process.env.SCHEDULED_RUN === 'true';
const requestedSlowMo = Number(process.env.PW_SLOWMO || 0);
const slowMoMs = Number.isFinite(requestedSlowMo) && requestedSlowMo > 0 ? requestedSlowMo : 0;

export default defineConfig({

  /* Test folders */
  testMatch: [
    'tests/**/*.spec.ts',
    'Test_Classes/**/*.spec.ts'
  ],

  /* Sequential execution for Jenkins stability */
  fullyParallel: false,

  /* Prevent accidental test.only in CI */
  forbidOnly: !!process.env.CI,

  /* Continue full execution even after failures */
  maxFailures: 0,

  /* Keep scheduler output as one final result per test */
  retries: isScheduledRun ? 0 : (process.env.CI ? 2 : 1),

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
      outputFolder: 'reports/report/html-report',
      open: isScheduledRun ? 'never' : 'always'
    }],
    ['json', {
      outputFile: 'reports/result/json-report/results.json'
    }],
    ['list'],
    ['allure-playwright', {
      resultsDir: 'reports/result/allure-results'
    }],
  ],

  /* Global setup */
  globalSetup: './Base_Class/globalSetup.ts',

  /* Shared settings */
  use: {

    /* Always run in headed mode */
    headless: false,

    /* Application URL */
    baseURL,

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

      slowMo: slowMoMs,

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
  outputDir: './reports/failed-screenshot',

  /* Browser projects */
  projects: [
    {
      name: 'chromium',
    },
  ],
});