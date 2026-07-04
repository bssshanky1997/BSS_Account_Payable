import type { Page } from '@playwright/test';

export class SmartAPListPage {
  constructor(private readonly page: Page) {}

  async openApInvoiceFromQuickLinks(): Promise<void> {
    // Step 1: Open Accounts Payable Quick Links.
    const apQuickLinks = this.page
      .locator('div.card-body:has(h5:has-text("Accounts Payable")) button#quickLinks2')
      .first();
    await apQuickLinks.waitFor({ state: 'visible', timeout: 10_000 });
    await apQuickLinks.click();

    // Step 2: Select visible AP Invoice option from Quick Links.
    const apInvoice = this.page
      .locator('a:has-text("AP Invoice"):visible, button:has-text("AP Invoice"):visible, [title*="AP Invoice" i]:visible')
      .first();
    await apInvoice.waitFor({ state: 'visible', timeout: 10_000 });
    await apInvoice.click();

    // Step 3: Wait until AP Invoice page finishes loading.
    await this.page.waitForLoadState('networkidle');
  }
}
