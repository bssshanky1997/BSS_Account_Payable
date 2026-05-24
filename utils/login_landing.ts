import { type Locator, type Page } from '@playwright/test';
import { getEnvConfig } from '../config/qa.env';
import { LoginPage } from '../pages/Regression_Suite/P001_login_page';
import { TIMEOUTS } from './constants';

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

export async function login_landing(page: Page): Promise<Page> {
  const envConfig = getEnvConfig();
  if (!envConfig.username || !envConfig.password || !envConfig.subscriberId) {
    throw new Error('Missing USERNAME/PASSWORD/SUBSCRIBER_ID in .env');
  }

  const propertyCode = process.env.PROPERTY_CODE ?? '827';
  const loginPage = new LoginPage(page);

  await loginPage.navigate();
  const appPage = await loginPage.login(envConfig.username, envConfig.password, envConfig.subscriberId);
  await appPage.waitForLoadState('domcontentloaded', { timeout: TIMEOUTS.LONG });

  const companySelectorOpened = await clickFirstActionable(
    [appPage.locator('#compDiv').getByRole('img'), appPage.locator('#compDiv img')],
    TIMEOUTS.MEDIUM
  );

  if (!companySelectorOpened) return appPage;

  const companyDialog = appPage.frameLocator("iframe[name='_dlgOpenerIframe1']");
  const radioSelector = companyDialog.locator('#radio2');
  const inputValue = companyDialog.locator('#InputValue');
  const okButton = companyDialog.getByRole('button', { name: 'OK' });

  await radioSelector.waitFor({ state: 'visible', timeout: TIMEOUTS.LONG });
  await radioSelector.click();
  await inputValue.waitFor({ state: 'visible', timeout: TIMEOUTS.LONG });
  await inputValue.click();
  await inputValue.clear();
  await inputValue.type(propertyCode, { delay: 50 });
  await inputValue.press('Tab');

  for (let idx = 0; idx < 20; idx += 1) {
    if (await okButton.isEnabled()) {
      await okButton.click();
      break;
    }
    await appPage.waitForTimeout(500);
  }

  return appPage;
}
