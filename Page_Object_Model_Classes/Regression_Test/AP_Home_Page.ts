import { expect, type Locator, type Page } from '@playwright/test';

export class APHomePage {
  constructor(private readonly page: Page) {}

  private async ensureVisible(locator: Locator, timeoutMs = 15_000): Promise<void> {
    await locator.waitFor({ state: 'visible', timeout: timeoutMs });
  }

  private async clickWhenReady(locator: Locator, timeoutMs = 15_000): Promise<void> {
    await this.ensureVisible(locator, timeoutMs);
    await expect(locator).toBeEnabled({ timeout: timeoutMs });
    await locator.click().catch(() => locator.click({ force: true }));
  }

  async changeCompanyId(companyId: string): Promise<void> {
    // Step 1: Open company search dialog from AP home header.
    const companyPickerIcon = this.page.locator('#compDiv').getByRole('img');
    await this.clickWhenReady(companyPickerIcon);

    // Step 2: Search by company ID and confirm selection.
    const dialogIframe = this.page.locator('iframe[name="_dlgOpenerIframe1"]');
    await this.ensureVisible(dialogIframe);
    const dialogFrame = this.page.frameLocator('iframe[name="_dlgOpenerIframe1"]');
    const companyIdRadio = dialogFrame.locator('#radio2');
    await this.ensureVisible(companyIdRadio);
    await companyIdRadio.check().catch(() => companyIdRadio.click({ force: true }));

    const inputValue = dialogFrame.locator('#InputValue');
    await this.ensureVisible(inputValue);
    await inputValue.click().catch(() => inputValue.click({ force: true }));
    await inputValue.press('Control+A');
    await inputValue.press('Delete');
    await inputValue.type(companyId);
    await inputValue.press('Tab');

    const okButton = dialogFrame.getByRole('button', { name: 'OK' });
    await this.clickWhenReady(okButton);

    // Wait for company-switch refresh to settle before next test step.
    await this.page.waitForLoadState('domcontentloaded').catch(() => {});
    await this.page.waitForLoadState('networkidle').catch(() => {});
    await this.ensureVisible(this.page.locator('#compDiv').first(), 20_000).catch(() => {});
  }
}
