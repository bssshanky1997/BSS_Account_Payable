import type { Page } from '@playwright/test';

export class SmartApDetailPage {
  constructor(private readonly page: Page) {}

  async openHomePage(): Promise<void> {
    await this.page.goto('/j4/default.jsp');
    await this.page.waitForLoadState('domcontentloaded');
  }
}
