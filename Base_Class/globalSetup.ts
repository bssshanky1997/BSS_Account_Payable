import path from 'path';
import { mkdir } from 'fs/promises';
import { chromium, type FullConfig } from '@playwright/test';

const LOGIN_PATH = '/j4/login.jsp';
const HOME_PATH = '/j4/default.jsp';
const DEFAULT_AUTH_STATE_PATH = 'playwright/.auth/user.json';
const PAGE_TIMEOUT = 60_000;
const DEFAULT_BASE_URL = 'https://appqa.birchstreet.co';

type LoginCredentials = {
  username: string;
  password: string;
  subscriberId: string;
};

function readLoginCredentials(): LoginCredentials {
  const credentials: LoginCredentials = {
    username: String(process.env.USERNAME || '').trim(),
    password: String(process.env.PASSWORD || '').trim(),
    subscriberId: String(process.env.SUBSCRIBER_ID || '').trim(),
  };

  if (!credentials.username || !credentials.password || !credentials.subscriberId) {
    throw new Error('Missing USERNAME, PASSWORD or SUBSCRIBER_ID in .env');
  }

  return credentials;
}

function readBaseUrl(): string {
  return String(process.env.BASE_URL || DEFAULT_BASE_URL).trim();
}

function resolveAuthStatePath(config: FullConfig): string {
  const configuredStorageState =
    typeof config.projects?.[0]?.use?.storageState === 'string' ? config.projects[0].use.storageState : null;

  return path.resolve(process.cwd(), configuredStorageState || DEFAULT_AUTH_STATE_PATH);
}

function isHeadlessMode(): boolean {
  return false;
}

async function performLogin(
  page: import('@playwright/test').Page,
  loginUrl: string,
  credentials: LoginCredentials
): Promise<void> {
  const hasPostLoginSignal = async (): Promise<boolean> => {
    const companySwitcherVisible = await page.locator('#compDiv').isVisible().catch(() => false);
    if (companySwitcherVisible) return true;

    const quickLinksVisible = await page.locator('#quickLinks1, #quickLinks2').first().isVisible().catch(() => false);
    if (quickLinksVisible) return true;

    return !page.url().includes(LOGIN_PATH);
  };

  await page.goto(loginUrl, { waitUntil: 'domcontentloaded', timeout: PAGE_TIMEOUT });
  await page.locator('#loginID').fill(credentials.username);
  await page.locator('#password').fill(credentials.password);
  await page.locator('#subscriberID').fill(credentials.subscriberId);

  const loginButton = page.locator('#submitLogin').first();
  if (await loginButton.isVisible().catch(() => false)) {
    await loginButton.click({ noWaitAfter: true }).catch(async () => {
      await loginButton.click({ force: true, noWaitAfter: true });
    });
  } else {
    await page.getByRole('button', { name: 'Login' }).click({ noWaitAfter: true }).catch(async () => {
      await page.getByRole('button', { name: 'Login' }).click({ force: true, noWaitAfter: true });
    });
  }

  const loginDeadline = Date.now() + PAGE_TIMEOUT;
  while (Date.now() < loginDeadline) {
    if (await hasPostLoginSignal()) break;
    await page.waitForTimeout(500);
  }

  const loginError = page.locator('.error, #error, [class*="error"]').first();
  if (await loginError.isVisible().catch(() => false)) {
    const message = (await loginError.textContent())?.trim() || 'Unknown login error';
    throw new Error(`Login failed in global setup: ${message}`);
  }

  if (!(await hasPostLoginSignal())) {
    throw new Error('Login failed in global setup: post-login home signals were not visible within timeout.');
  }
}

/**
 * Global setup flow:
 * 1) Read credentials from env
 * 2) Open browser and login once
 * 3) Save authenticated storage state
 */
async function globalSetup(config: FullConfig): Promise<void> {
  const credentials = readLoginCredentials();
  const baseUrl = readBaseUrl();
  const loginUrl = new URL(LOGIN_PATH, baseUrl).toString();
  const homeUrl = new URL(HOME_PATH, baseUrl).toString();
  const authStatePath = resolveAuthStatePath(config);
  const isHeadless = isHeadlessMode();

  const browser = await chromium.launch({
    headless: isHeadless,
    args: ['--start-maximized'],
  });
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    viewport: isHeadless ? { width: 1920, height: 1080 } : null,
  });
  const page = await context.newPage();

  try {
    await performLogin(page, loginUrl, credentials);
    await page.goto(homeUrl, { waitUntil: 'domcontentloaded', timeout: PAGE_TIMEOUT });

    await mkdir(path.dirname(authStatePath), { recursive: true });
    await context.storageState({ path: authStatePath });
  } finally {
    await browser.close();
  }
}

export default globalSetup;
