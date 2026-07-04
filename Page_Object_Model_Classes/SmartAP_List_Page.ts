import { expect, type Locator, type Page } from '@playwright/test';

export class SmartAPListPage {
  constructor(private readonly page: Page) {}

  private async ensureVisible(locator: Locator, timeoutMs = 10_000): Promise<void> {
    await locator.waitFor({ state: 'visible', timeout: timeoutMs });
  }

  private async clickWhenReady(locator: Locator, timeoutMs = 10_000): Promise<void> {
    await this.ensureVisible(locator, timeoutMs);
    await expect(locator).toBeEnabled({ timeout: timeoutMs });
    await locator.click().catch(() => locator.click({ force: true }));
  }

  async openApInvoiceFromQuickLinks(): Promise<void> {
    // Step 1: Open Accounts Payable Quick Links.
    const apQuickLinks = this.page
      .locator('div.card-body:has(h5:has-text("Accounts Payable")) button#quickLinks2')
      .first();
    await this.clickWhenReady(apQuickLinks);

    // Step 2: Select visible AP Invoice option from Quick Links.
    const apInvoice = this.page
      .locator('a:has-text("AP Invoice"):visible, button:has-text("AP Invoice"):visible, [title*="AP Invoice" i]:visible')
      .first();
    await this.clickWhenReady(apInvoice);

    // Step 3: Wait until AP Invoice page finishes loading.
    await this.page.waitForLoadState('networkidle');
  }
}
