import path from 'path';
import { createHash } from 'crypto';
import { mkdir } from 'fs/promises';
import { chromium, FullConfig } from '@playwright/test';
import { getEnvConfig } from '../config/qa.env';

const LOGIN_PATH = '/j4/login.jsp';
const MAX_LOGIN_ATTEMPTS = 3;
const PLACEHOLDER_AUTH_VALUES = new Set([
  'your_username',
  'your_password',
  'your_subscriber_id',
  'changeme',
]);
const TELEMETRY_LIMIT = 20;

type LoginTelemetry = {
  loginResponses: string[];
  requestFailures: string[];
  consoleErrors: string[];
};

function hasPlaceholderCredential(value: string): boolean {
  return PLACEHOLDER_AUTH_VALUES.has(value.trim().toLowerCase());
}

function normalizeCredential(value: string): string {
  return value.trim();
}

function credentialFingerprint(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 10);
}

function credentialMeta(name: string, rawValue: string): string {
  const normalizedValue = normalizeCredential(rawValue);
  return `${name}{rawLen=${rawValue.length},trimmedLen=${normalizedValue.length},changedByTrim=${
    rawValue !== normalizedValue
  },fp=${credentialFingerprint(normalizedValue)}}`;
}

function pushLimited(items: string[], value: string, max = TELEMETRY_LIMIT): void {
  items.push(value);
  if (items.length > max) {
    items.splice(0, items.length - max);
  }
}

function formatTelemetrySegment(title: string, values: string[]): string {
  if (values.length === 0) return `${title}: none`;
  return `${title}: ${values.join(' | ')}`;
}

async function isOnLoginScreen(page: import('@playwright/test').Page): Promise<boolean> {
  const urlLooksLikeLogin = page.url().includes(LOGIN_PATH);
  const loginFieldVisible = await page.locator('#loginID').isVisible().catch(() => false);
  return urlLooksLikeLogin || loginFieldVisible;
}

async function attemptLogin(
  page: import('@playwright/test').Page,
  loginUrl: string,
  username: string,
  password: string,
  subscriberId: string,
  telemetry: LoginTelemetry
): Promise<{ success: boolean; reason: string }> {
  const responsesBefore = telemetry.loginResponses.length;
  const failuresBefore = telemetry.requestFailures.length;
  const consoleErrorsBefore = telemetry.consoleErrors.length;

  await page.goto(loginUrl, {
    waitUntil: 'domcontentloaded',
    timeout: 60_000,
  });
  await page.locator('#loginID').waitFor({ state: 'visible', timeout: 30_000 });
  await page.locator('#loginID').fill(username);
  await page.locator('#password').fill(password);
  await page.locator('#subscriberID').fill(subscriberId);

  const loginButton = page.getByRole('button', { name: 'Login' });
  await loginButton.click().catch(() => undefined);

  // Some environments swallow the first click; submit again via Enter as fallback.
  if (await isOnLoginScreen(page)) {
    await page.locator('#subscriberID').press('Enter').catch(() => undefined);
  }

  await page.waitForLoadState('networkidle', { timeout: 60_000 }).catch(() => undefined);
  await page.waitForLoadState('domcontentloaded', { timeout: 60_000 }).catch(() => undefined);
  await page.waitForTimeout(1500);

  const stillOnLoginPage = await isOnLoginScreen(page);
  if (!stillOnLoginPage) {
    return { success: true, reason: 'navigated away from login page' };
  }

  const pageTitle = await page.title().catch(() => 'N/A');
  const loginErrorText = await page
    .locator('.error, .alert, .login-error, #error, .message')
    .first()
    .innerText()
    .catch(() => '');

  return {
    success: false,
    reason: `Current URL: ${page.url()}. Page title: ${pageTitle}. Visible message: ${loginErrorText || 'none found'}. ${formatTelemetrySegment(
      'network',
      telemetry.loginResponses.slice(responsesBefore)
    )}. ${formatTelemetrySegment('request failures', telemetry.requestFailures.slice(failuresBefore))}. ${formatTelemetrySegment(
      'console errors',
      telemetry.consoleErrors.slice(consoleErrorsBefore)
    )}.`,
  };
}

/**
 * Global Setup — authenticates once and stores browser state.
 */
async function globalSetup(_config: FullConfig): Promise<void> {
  const envConfig = getEnvConfig();
  const username = normalizeCredential(envConfig.username);
  const password = normalizeCredential(envConfig.password);
  const subscriberId = normalizeCredential(envConfig.subscriberId);
  const authStatePath = 'playwright/.auth/user.json';
  const loginUrl = new URL(LOGIN_PATH, envConfig.baseURL).toString();
  const credentialSummary = [
    credentialMeta('USERNAME', envConfig.username),
    credentialMeta('PASSWORD', envConfig.password),
    credentialMeta('SUBSCRIBER_ID', envConfig.subscriberId),
  ].join(', ');

  if (!username || !password || !subscriberId) {
    throw new Error(
      `Missing login credentials for global setup. Set USERNAME, PASSWORD, and SUBSCRIBER_ID in .env. Credential summary: ${credentialSummary}.`
    );
  }

  if (hasPlaceholderCredential(username) || hasPlaceholderCredential(password) || hasPlaceholderCredential(subscriberId)) {
    throw new Error(
      `Global setup credentials are placeholder values. Update USERNAME, PASSWORD, and SUBSCRIBER_ID in .env with real QA credentials. Credential summary: ${credentialSummary}.`
    );
  }

  const browser = await chromium.launch({
    headless: false,
    args: [
      '--start-maximized',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--no-sandbox',
      '--disable-setuid-sandbox',
    ],
  });
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    viewport: null,
  });
  const page = await context.newPage();
  const telemetry: LoginTelemetry = {
    loginResponses: [],
    requestFailures: [],
    consoleErrors: [],
  };

  page.on('response', (response) => {
    const request = response.request();
    const url = response.url();
    const method = request.method();
    const shouldTrack =
      url.includes('/j4/') && (url.includes('/login') || url.includes('/default.jsp') || method === 'POST');

    if (!shouldTrack) return;
    pushLimited(telemetry.loginResponses, `${method} ${url} -> ${response.status()}`);
  });

  page.on('requestfailed', (request) => {
    pushLimited(
      telemetry.requestFailures,
      `${request.method()} ${request.url()} -> ${request.failure()?.errorText || 'unknown'}`
    );
  });

  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    pushLimited(telemetry.consoleErrors, message.text());
  });

  try {
    let lastFailureReason = 'unknown';
    let loggedIn = false;

    for (let attempt = 1; attempt <= MAX_LOGIN_ATTEMPTS; attempt += 1) {
      const result = await attemptLogin(page, loginUrl, username, password, subscriberId, telemetry);
      if (result.success) {
        loggedIn = true;
        break;
      }

      lastFailureReason = `[attempt ${attempt}/${MAX_LOGIN_ATTEMPTS}] ${result.reason}`;
      await page.waitForTimeout(2000);
    }

    if (!loggedIn) {
      const diagnosticsDir = path.resolve('test-results', 'global-setup');
      await mkdir(diagnosticsDir, { recursive: true });

      const screenshotPath = path.join(diagnosticsDir, `login-failed-${Date.now()}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => undefined);

      throw new Error(
        `Global setup login failed after ${MAX_LOGIN_ATTEMPTS} attempts. ${lastFailureReason} ${formatTelemetrySegment(
          'recent network',
          telemetry.loginResponses
        )}. ${formatTelemetrySegment('recent request failures', telemetry.requestFailures)}. ${formatTelemetrySegment(
          'recent console errors',
          telemetry.consoleErrors
        )}. Credential summary: ${credentialSummary}. Screenshot: ${screenshotPath}. Check credentials and application availability.`
      );
    }

    await mkdir(path.dirname(authStatePath), { recursive: true });
    await page.context().storageState({
      path: authStatePath,
    });
  } finally {
    await browser.close();
  }
}

export default globalSetup;
