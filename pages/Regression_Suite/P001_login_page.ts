import { type Locator, type Page, type TestInfo } from '@playwright/test';
import { TIMEOUTS, URLS } from '../../utils/constants';

export class LoginPage {
  readonly page: Page;
  readonly loginId: Locator;
  readonly password: Locator;
  readonly subscriberId: Locator;
  readonly loginButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.loginId = page.locator('#loginID');
    this.password = page.locator('#password');
    this.subscriberId = page.locator('#subscriberID');
    this.loginButton = page.getByRole('button', { name: 'Login' });
  }

  async navigate(): Promise<void> {
    await this.page.goto(URLS.J4_LOGIN, {
      waitUntil: 'domcontentloaded',
      timeout: TIMEOUTS.PAGE_LOAD,
    });
    await this.loginId.waitFor({ state: 'visible', timeout: TIMEOUTS.LONG });
    await this.password.waitFor({ state: 'visible', timeout: TIMEOUTS.MEDIUM });
    await this.subscriberId.waitFor({ state: 'visible', timeout: TIMEOUTS.MEDIUM });
    await this.loginButton.waitFor({ state: 'visible', timeout: TIMEOUTS.LONG });
  }

  async login(loginId: string, passwd: string, subscriberId: string): Promise<Page> {
    await this.loginId.fill(loginId);
    await this.password.fill(passwd);
    await this.subscriberId.fill(subscriberId);

    const popupPromise = this.page.waitForEvent('popup', { timeout: TIMEOUTS.SHORT }).catch(() => null);
    await this.loginButton.click();
    const popup = await popupPromise;
    const activePage = popup ?? this.page;

    try {
      await activePage.waitForLoadState('domcontentloaded', { timeout: TIMEOUTS.LONG });
    } catch {
      // Keep flow resilient; some environments stay interactive without full load events.
    }

    const okButton = activePage.getByRole('button', { name: 'OK' });
    if (await okButton.isVisible().catch(() => false)) {
      await okButton.click().catch(() => undefined);
    }

    if (!activePage.isClosed()) return activePage;
    if (!this.page.isClosed()) return this.page;

    for (const openPage of this.page.context().pages()) {
      if (!openPage.isClosed()) {
        return openPage;
      }
    }

    throw new Error('Login completed but no active page is available.');
  }

  static skipIfCredentialsMissing(
    testInfo: TestInfo,
    username: string,
    password: string,
    subscriberId: string
  ): void {
    if (!username || !password || !subscriberId) {
      testInfo.skip(
        true,
        'Create Bss_AccountPayable/.env and set USERNAME, PASSWORD, SUBSCRIBER_ID (or export them in shell).'
      );
    }
  }
}
