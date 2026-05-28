import path from 'path';
import { mkdir } from 'fs/promises';
import { chromium, FullConfig } from '@playwright/test';
import { getEnvConfig } from '../config/qa.env';

/**
 * Global Setup — authenticates once and stores browser state.
 */
async function globalSetup(_config: FullConfig): Promise<void> {
  const envConfig = getEnvConfig();
  const { username, password, subscriberId } = envConfig;
  const loginUrl = new URL('/j4/login.jsp', envConfig.baseURL).toString();
  const authStatePath = 'playwright/.auth/user.json';

  if (!username || !password || !subscriberId) {
    throw new Error(
      'Missing login credentials for global setup. Set USERNAME, PASSWORD, and SUBSCRIBER_ID in .env.'
    );
  }

  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.goto(loginUrl, {
    waitUntil: 'domcontentloaded',
    timeout: 60_000,
  });
  await page.locator('#loginID').fill(username);
  await page.locator('#password').fill(password);
  await page.locator('#subscriberID').fill(subscriberId);
  await page.getByRole('button', { name: 'Login' }).click();
  await page.waitForLoadState('domcontentloaded', { timeout: 60_000 }).catch(() => undefined);
  await page.waitForURL((url) => !url.pathname.endsWith('/login.jsp'), { timeout: 60_000 }).catch(() => undefined);

  const stillOnLoginPage = page.url().includes('/j4/login.jsp');
  const loginButtonStillVisible = await page.getByRole('button', { name: 'Login' }).isVisible().catch(() => false);
  if (stillOnLoginPage || loginButtonStillVisible) {
    throw new Error(
      `Global setup login failed. Current URL: ${page.url()}. Check credentials and application availability.`
    );
  }

  await mkdir(path.dirname(authStatePath), { recursive: true });
  await page.context().storageState({
    path: authStatePath,
  });

  await browser.close();
}

export default globalSetup;
