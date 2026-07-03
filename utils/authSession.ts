import fs from 'fs';
import path from 'path';
import { chromium, type Page } from '@playwright/test';

const LOGIN_PATH = '/j4/login.jsp';
const DEFAULT_PATH = '/j4/default.jsp';
const DEFAULT_BASE_URL = 'https://appqa.birchstreet.co';
const PLACEHOLDER_AUTH_VALUES = new Set([
  'your_username',
  'your_password',
  'your_subscriber_id',
  'changeme',
]);

const hasPlaceholderCredential = (value: string): boolean =>
  PLACEHOLDER_AUTH_VALUES.has(value.trim().toLowerCase());

const getBaseUrl = (): string => String(process.env.BASE_URL || DEFAULT_BASE_URL).trim();
const getUsername = (): string => String(process.env.USERNAME || '').trim();
const getPassword = (): string => String(process.env.PASSWORD || '').trim();
const getSubscriberId = (): string => String(process.env.SUBSCRIBER_ID || '').trim();

export const AUTH_STATE_PATH = '.auth/user.json';
export const AUTH_STATE_ABS_PATH = path.resolve(process.cwd(), AUTH_STATE_PATH);

const waitForPostLogin = async (page: Page): Promise<void> => {
  await page.waitForLoadState('networkidle', { timeout: 60_000 }).catch(() =>
    page.waitForLoadState('domcontentloaded', { timeout: 60_000 }).catch(() => undefined)
  );
  await page.waitForTimeout(500).catch(() => undefined);
};

export const hasAuthCredentials = (): boolean => {
  const username = getUsername();
  const password = getPassword();
  const subscriberId = getSubscriberId();
  if (!username || !password || !subscriberId) return false;

  return !(
    hasPlaceholderCredential(username) ||
    hasPlaceholderCredential(password) ||
    hasPlaceholderCredential(subscriberId)
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
  if (!hasAuthCredentials()) {
    throw new Error(
      'Missing valid USERNAME, PASSWORD, or SUBSCRIBER_ID for authentication. Ensure .env contains real credentials and not placeholder values.'
    );
  }

  const resolvedBaseUrl = baseURL ?? getBaseUrl();
  await page.goto(resolveUrl(LOGIN_PATH, resolvedBaseUrl), {
    waitUntil: 'domcontentloaded',
    timeout: 60_000,
  });
  await page.locator('#loginID').fill(getUsername());
  await page.locator('#password').fill(getPassword());
  await page.locator('#subscriberID').fill(getSubscriberId());
  await page.getByRole('button', { name: 'Login' }).click();
  await waitForPostLogin(page);

  if (await isLoginScreenVisible(page, 1500)) {
    throw new Error('Authentication failed. Login page is still visible after submit.');
  }
};

export const ensureAuthenticatedPage = async (page: Page, targetRouteOrUrl = DEFAULT_PATH): Promise<boolean> => {
  const targetUrl = resolveUrl(targetRouteOrUrl, getBaseUrl());

  await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  if (!(await isLoginScreenVisible(page))) return false;

  await loginWithCredentials(page, getBaseUrl());
  await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  return true;
};

export const ensureAuthStorageState = async (baseURL?: string): Promise<'created' | 'skipped'> => {
  if (!hasAuthCredentials()) return 'skipped';

  const resolvedBaseUrl = baseURL ?? getBaseUrl();
  await fs.promises.mkdir(path.dirname(AUTH_STATE_ABS_PATH), { recursive: true });

  const browser = await chromium.launch({
    headless: false,
    args: ['--start-maximized'],
  });
  try {
    const context = await browser.newContext({
      baseURL: resolvedBaseUrl,
      ignoreHTTPSErrors: true,
      viewport: null,
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
