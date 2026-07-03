const path = require('path');
const dotenv = require('dotenv');
const { chromium } = require('@playwright/test');

dotenv.config({
  path: path.resolve(__dirname, '..', '.env'),
  override: true,
});

const DEFAULT_BASE_URL = 'https://appqa.birchstreet.co';
const LOGIN_PATH = '/j4/login.jsp';
const PAGE_TIMEOUT = 60_000;
const LOGIN_SETTLE_MS = 800;

function requiredEnv(name) {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value.trim();
}

async function run() {
  const username = requiredEnv('USERNAME');
  const password = requiredEnv('PASSWORD');
  const subscriberId = requiredEnv('SUBSCRIBER_ID');
  const baseUrl = String(process.env.BASE_URL || DEFAULT_BASE_URL).trim();
  const loginUrl = new URL(LOGIN_PATH, baseUrl).toString();
  const browser = await chromium.launch({
    headless: false,
    args: ['--start-maximized'],
  });

  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    viewport: null,
  });
  const page = await context.newPage();

  try {
    await page.goto(loginUrl, {
      waitUntil: 'domcontentloaded',
      timeout: PAGE_TIMEOUT,
    });
    await page.locator('#loginID').fill(username);
    await page.locator('#password').fill(password);
    await page.locator('#subscriberID').fill(subscriberId);
    await page.getByRole('button', { name: 'Login' }).click();

    await page.waitForLoadState('networkidle', { timeout: PAGE_TIMEOUT }).catch(() => undefined);
    await page.waitForTimeout(LOGIN_SETTLE_MS);

    const stillOnLogin = await page
      .locator('#loginID')
      .isVisible()
      .catch(() => false);
    const hasCompanyMenu = await page
      .locator('#compDiv')
      .isVisible()
      .catch(() => false);
    const currentUrl = page.url();
    const likelyLoggedIn = !stillOnLogin && (hasCompanyMenu || currentUrl.includes('/j4/default.jsp') || currentUrl.includes('/j4/'));

    console.log(`Login URL: ${loginUrl}`);
    console.log(`Current URL after submit: ${currentUrl}`);
    console.log(`Login field visible after submit: ${stillOnLogin ? 'yes' : 'no'}`);
    console.log(`Company menu visible: ${hasCompanyMenu ? 'yes' : 'no'}`);
    console.log(`Auth verdict: ${likelyLoggedIn ? 'LIKELY_ACCEPTED' : 'REJECTED_OR_STAYED_ON_LOGIN'}`);

    if (!likelyLoggedIn) {
      const errorText = await page
        .locator('.error, .alert, .login-error, #error, .message')
        .first()
        .innerText()
        .catch(() => '');
      if (errorText) {
        console.log(`Visible error: ${errorText}`);
      }
      process.exitCode = 1;
    }
  } finally {
    await context.close();
    await browser.close();
  }
}

run().catch((error) => {
  console.error(`Login validation script failed: ${error.message}`);
  process.exitCode = 2;
});
