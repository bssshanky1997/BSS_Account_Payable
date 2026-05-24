import { type Locator } from '@playwright/test';
import { test, expect } from '../../fixtures/testFixture';
import { getEnvConfig } from '../../config/qa.env';
import { LoginPage } from '../../pages/Regression_Suite/P001_login_page';
import { TIMEOUTS, URLS, urlPathEndsWith } from '../../utils/constants';

test.use({ storageState: { cookies: [], origins: [] } });

test('TC001 J4 login and select company @login @regression', async ({ page }) => {
  const clickFirstActionable = async (locators: Locator[], timeout = TIMEOUTS.MEDIUM): Promise<boolean> => {
    for (const locator of locators) {
      const candidate = locator.first();
      try {
        await candidate.waitFor({ state: 'visible', timeout });
        await candidate.click();
        return true;
      } catch {
        // Try next locator candidate.
      }
    }
    return false;
  };

  const envConfig = getEnvConfig();
  const propertyCode = process.env.PROPERTY_CODE ?? '827';

  test.skip(
    !envConfig.username || !envConfig.password || !envConfig.subscriberId,
    'Create Bss_AccountPayable/.env and set USERNAME, PASSWORD, SUBSCRIBER_ID.'
  );

  const loginPage = new LoginPage(page);
  const j4LoginUrl = urlPathEndsWith(URLS.J4_LOGIN);

  await loginPage.navigate();
  await expect(page).toHaveURL(j4LoginUrl);

  const appPage = await loginPage.login(envConfig.username, envConfig.password, envConfig.subscriberId);
  await expect(appPage).not.toHaveURL(j4LoginUrl, { timeout: TIMEOUTS.PAGE_LOAD });
  await expect(appPage).toHaveURL(/birchstreet/i, { timeout: TIMEOUTS.PAGE_LOAD });
  await appPage.waitForLoadState('domcontentloaded', { timeout: TIMEOUTS.LONG });

  const companySelectorOpened = await clickFirstActionable(
    [appPage.locator('#compDiv').getByRole('img'), appPage.locator('#compDiv img')],
    TIMEOUTS.MEDIUM
  );
  expect(companySelectorOpened).toBeTruthy();

  const companyDialog = appPage.frameLocator("iframe[name='_dlgOpenerIframe1']");
  const radioSelector = companyDialog.locator('#radio2');
  const inputValue = companyDialog.locator('#InputValue');
  const okButton = companyDialog.getByRole('button', { name: 'OK' });

  await expect(radioSelector).toBeVisible({ timeout: TIMEOUTS.LONG });
  await radioSelector.click();
  await expect(inputValue).toBeVisible({ timeout: TIMEOUTS.LONG });
  await expect(inputValue).toBeEnabled({ timeout: TIMEOUTS.LONG });
  await inputValue.click();
  await inputValue.clear();
  await inputValue.type(propertyCode, { delay: 50 });
  await inputValue.press('Tab');

  let okClicked = false;
  for (let idx = 0; idx < 20; idx += 1) {
    if (await okButton.isEnabled()) {
      await okButton.click();
      okClicked = true;
      break;
    }
    await appPage.waitForTimeout(500);
  }

  if (!okClicked) {
    await expect(okButton).toBeVisible({ timeout: TIMEOUTS.SHORT });
  }
});
