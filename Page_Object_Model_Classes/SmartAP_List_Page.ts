import type { Page } from '@playwright/test';

export class SmartAPListPage {
  constructor(private readonly page: Page) {}

  async openSmartAPListPage(): Promise<void> {
    const entry = this.page.locator('a:has-text("Smart AP"), a:has-text("SmartAP"), [title*="Smart AP" i]').first();
    if (await entry.isVisible().catch(() => false)) {
      await entry.click();
    }
    await this.page.waitForLoadState('domcontentloaded');
  }
}
