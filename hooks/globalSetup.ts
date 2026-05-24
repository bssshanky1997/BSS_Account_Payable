import { chromium, FullConfig } from '@playwright/test';

/**
 * Global Setup — authenticates once and stores browser state.
 */
async function globalSetup(_config: FullConfig): Promise<void> {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.goto('https://appqa.birchstreet.co/j4/login.jsp');
  await page.locator('#loginID').fill('bss_shpandey');
  await page.locator('#password').fill('Reset1234');
  await page.locator('#subscriberID').fill('641');
  await page.getByRole('button', { name: 'Login' }).click();

  await page.context().storageState({
    path: 'playwright/.auth/user.json',
  });

  await browser.close();
}

export default globalSetup;
