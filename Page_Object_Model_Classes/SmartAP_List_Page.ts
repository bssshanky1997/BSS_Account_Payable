import type { Page } from '@playwright/test';

export class SmartAPListPage {
  constructor(private readonly page: Page) {}

  async openApInvoiceFromQuickLinks(): Promise<void> {
    await this.page.waitForLoadState('domcontentloaded').catch(() => {});
    await this.page.waitForLoadState('networkidle').catch(() => {});

    const apQuickLinks = this.page
      .locator('div.card-body:has(h5:has-text("Accounts Payable")) button#quickLinks2')
      .first();
    await apQuickLinks.waitFor({ state: 'visible', timeout: 30_000 });
    await apQuickLinks.click();

    const apInvoiceCandidates = [
      this.page.locator('a:has-text("AP Invoice"):visible').first(),
      this.page.locator('button:has-text("AP Invoice"):visible').first(),
      this.page.locator('[title*="AP Invoice" i]:visible').first(),
      this.page.locator('a:has-text("AP Invoice"), button:has-text("AP Invoice"), [title*="AP Invoice" i]').first(),
    ];

    for (const candidate of apInvoiceCandidates) {
      if (await candidate.isVisible().catch(() => false)) {
        await candidate.waitFor({ state: 'visible', timeout: 10_000 }).catch(() => {});
        await candidate.click().catch(async () => {
          await candidate.click({ force: true });
        });
        await this.page.waitForLoadState('domcontentloaded').catch(() => {});
        await this.page.waitForLoadState('networkidle').catch(() => {});
        return;
      }
    }

    await apInvoiceCandidates[apInvoiceCandidates.length - 1].click({ force: true });
    await this.page.waitForLoadState('domcontentloaded').catch(() => {});
    await this.page.waitForLoadState('networkidle').catch(() => {});
  }
}
