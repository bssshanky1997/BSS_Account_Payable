import path from 'path';
import { mkdir } from 'fs/promises';
import { chromium, type FullConfig } from '@playwright/test';

const LOGIN_PATH = '/j4/login.jsp';
const HOME_PATH = '/j4/default.jsp';
const DEFAULT_AUTH_STATE_PATH = 'playwright/.auth/user.json';
const PAGE_TIMEOUT = 60_000;
const DEFAULT_BASE_URL = 'https://appqa.birchstreet.co';
/** How long to wait for the server to respond to the login POST before treating it as a hung/unavailable backend. */
const LOGIN_RESPONSE_TIMEOUT = Number(process.env.LOGIN_RESPONSE_TIMEOUT_MS) || 45_000;
/** Retries in case the login hang/timeout is a transient server issue rather than a persistent outage. */
const MAX_LOGIN_ATTEMPTS = Number(process.env.MAX_LOGIN_ATTEMPTS) || 2;
/** Pause before retrying, giving a transient server hiccup a chance to clear before we hammer it again. */
const LOGIN_RETRY_DELAY = 3_000;

type LoginCredentials = {
  username: string;
  password: string;
  subscriberId: string;
};

/**
 * Thrown only when the backend failed to respond to the login POST in time. Kept distinct
 * from credential/business-logic login failures so the retry loop in globalSetup() can retry
 * transient infra hangs without wasting time re-attempting a login that is genuinely wrong.
 */
class LoginTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LoginTimeoutError';
  }
}

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

  // Track the server's response to the login POST explicitly. Without this, if the
  // authentication backend hangs and never responds, the code would previously sit in
  // the polling loop below until an external factor (e.g. resource cleanup) force-closed
  // the browser, surfacing a confusing "Target page/context/browser has been closed" error
  // instead of a clear, actionable timeout.
  const loginResponsePromise = page
    .waitForResponse(
      response => response.request().method() === 'POST' && response.url().toLowerCase().includes('login.jsp'),
      { timeout: LOGIN_RESPONSE_TIMEOUT }
    )
    .catch(() => null);

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

  const loginResponse = await loginResponsePromise;
  if (!loginResponse && !(await hasPostLoginSignal())) {
    throw new LoginTimeoutError(
      `Login request timed out after ${LOGIN_RESPONSE_TIMEOUT / 1000}s: the server did not respond to the ` +
        `login POST to ${loginUrl}. This indicates the authentication backend is slow, hung, or unavailable ` +
        `(a server/environment issue) rather than a problem with the test script.`
    );
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
    let lastError: unknown;
    for (let attempt = 1; attempt <= MAX_LOGIN_ATTEMPTS; attempt += 1) {
      try {
        await performLogin(page, loginUrl, credentials);
        lastError = undefined;
        break;
      } catch (error) {
        lastError = error;
        const message = error instanceof Error ? error.message : String(error);
        console.warn(`[globalSetup] Login attempt ${attempt}/${MAX_LOGIN_ATTEMPTS} failed: ${message}`);

        // Only retry when the failure was a backend hang/timeout - a transient infra issue that
        // may clear up on its own. Wrong credentials or a genuine login-failure page won't be
        // fixed by retrying, so fail fast instead of wasting another full timeout cycle.
        if (!(error instanceof LoginTimeoutError)) {
          break;
        }
        if (attempt < MAX_LOGIN_ATTEMPTS) {
          await page.waitForTimeout(LOGIN_RETRY_DELAY);
        }
      }
    }
    if (lastError) {
      throw lastError;
    }

    await page.goto(homeUrl, { waitUntil: 'domcontentloaded', timeout: PAGE_TIMEOUT });

    await mkdir(path.dirname(authStatePath), { recursive: true });
    await context.storageState({ path: authStatePath });
  } finally {
    await browser.close();
  }
}

export default globalSetup;
