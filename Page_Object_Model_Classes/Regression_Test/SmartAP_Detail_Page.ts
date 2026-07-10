import { expect, type Locator, type Page } from '@playwright/test';
import { waitForLoaderToDisappear } from '../../utils/helpers';

export class NonPOInvoicePage {
  constructor(private readonly page: Page) {}

  private async ensureVisible(locator: Locator, timeoutMs = 10_000): Promise<void> {
    await locator.waitFor({ state: 'visible', timeout: timeoutMs });
  }

  private async clickWhenReady(locator: Locator, timeoutMs = 10_000): Promise<void> {
    await this.ensureVisible(locator, timeoutMs);
    await expect(locator).toBeEnabled({ timeout: timeoutMs });
    await locator.click().catch(() => locator.click({ force: true }));
  }

  private get createNewInvoiceDropdown(): Locator {
    return this.page
      .locator('button, a, span')
      .filter({ hasText: /create new invoice/i })
      .first();
  }

  private get createFromScratchOption(): Locator {
    return this.page
      .locator('button, a, span, li')
      .filter({ hasText: /create from scratch/i })
      .first();
  }

  async createInvoiceFromScratch(): Promise<void> {
    // Step 1: Wait for the AP Invoice list page to finish loading.
    await this.page.waitForLoadState('networkidle');

    // Step 2: Open the "Create New Invoice" dropdown.
    await this.clickWhenReady(this.createNewInvoiceDropdown);

    // Step 3: Wait for "Create From Scratch" option to become visible, then select it.
    await this.ensureVisible(this.createFromScratchOption);
    await this.clickWhenReady(this.createFromScratchOption);

    // Step 4: Wait for the new invoice form/page to finish loading before returning.
    await waitForLoaderToDisappear(this.page);
    await this.page.waitForLoadState('domcontentloaded').catch(() => {});
    await this.page.waitForLoadState('networkidle').catch(() => {});
  }
}
