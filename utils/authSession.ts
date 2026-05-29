import fs from 'fs';
import path from 'path';
import { chromium, type Page } from '@playwright/test';
import { getEnvConfig } from '../config/qa.env';

const LOGIN_PATH = '/j4/login.jsp';
const DEFAULT_PATH = '/j4/default.jsp';
const PLACEHOLDER_AUTH_VALUES = new Set([
  'your_username',
  'your_password',
  'your_subscriber_id',
  'changeme',
]);

const hasPlaceholderCredential = (value: string): boolean =>
  PLACEHOLDER_AUTH_VALUES.has(value.trim().toLowerCase());

export const AUTH_STATE_PATH = '.auth/user.json';
export const AUTH_STATE_ABS_PATH = path.resolve(process.cwd(), AUTH_STATE_PATH);

const waitForPostLogin = async (page: Page): Promise<void> => {
  await page.waitForLoadState('networkidle', { timeout: 60_000 }).catch(() =>
    page.waitForLoadState('domcontentloaded', { timeout: 60_000 }).catch(() => undefined)
  );
  await page.waitForTimeout(500).catch(() => undefined);
};

export const hasAuthCredentials = (): boolean => {
  const envConfig = getEnvConfig();
  if (!envConfig.username || !envConfig.password || !envConfig.subscriberId) return false;

  return !(
    hasPlaceholderCredential(envConfig.username) ||
    hasPlaceholderCredential(envConfig.password) ||
    hasPlaceholderCredential(envConfig.subscriberId)
  );
};

const resolveUrl = (routeOrUrl: string, baseURL: string): string => {
  if (/^https?:\/\//i.test(routeOrUrl)) return routeOrUrl;
  return new URL(routeOrUrl, baseURL).toString();
};

export const isLoginScreenVisible = async (page: Page, timeoutMs = 2500): Promise<boolean> => {
  if (page.url().toLowerCase().includes(LOGIN_PATH)) return true;
  return page
    .locator('#loginID')
    .first()
    .isVisible({ timeout: timeoutMs })
    .catch(() => false);
};

export const loginWithCredentials = async (page: Page, baseURL?: string): Promise<void> => {
  const envConfig = getEnvConfig();
  if (!hasAuthCredentials()) {
    throw new Error(
      'Missing valid USERNAME, PASSWORD, or SUBSCRIBER_ID for authentication. Ensure .env contains real credentials and not placeholder values.'
    );
  }

  const resolvedBaseUrl = baseURL ?? envConfig.baseURL;
  await page.goto(resolveUrl(LOGIN_PATH, resolvedBaseUrl), {
    waitUntil: 'domcontentloaded',
    timeout: 60_000,
  });
  await page.locator('#loginID').fill(envConfig.username);
  await page.locator('#password').fill(envConfig.password);
  await page.locator('#subscriberID').fill(envConfig.subscriberId);
  await page.getByRole('button', { name: 'Login' }).click();
  await waitForPostLogin(page);

  if (await isLoginScreenVisible(page, 1500)) {
    throw new Error('Authentication failed. Login page is still visible after submit.');
  }
};

export const ensureAuthenticatedPage = async (page: Page, targetRouteOrUrl = DEFAULT_PATH): Promise<boolean> => {
  const envConfig = getEnvConfig();
  const targetUrl = resolveUrl(targetRouteOrUrl, envConfig.baseURL);

  await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  if (!(await isLoginScreenVisible(page))) return false;

  await loginWithCredentials(page, envConfig.baseURL);
  await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  return true;
};

export const ensureAuthStorageState = async (baseURL?: string): Promise<'created' | 'skipped'> => {
  if (!hasAuthCredentials()) return 'skipped';

  const envConfig = getEnvConfig();
  const resolvedBaseUrl = baseURL ?? envConfig.baseURL;
  await fs.promises.mkdir(path.dirname(AUTH_STATE_ABS_PATH), { recursive: true });

  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
      baseURL: resolvedBaseUrl,
      ignoreHTTPSErrors: true,
    });
    try {
      const page = await context.newPage();
      await loginWithCredentials(page, resolvedBaseUrl);
      await context.storageState({ path: AUTH_STATE_ABS_PATH });
    } finally {
      await context.close();
    }
    return 'created';
  } finally {
    await browser.close();
  }
};
