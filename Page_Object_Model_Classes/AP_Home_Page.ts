import { type FrameLocator, type Locator, type Page } from '@playwright/test';

export class APHomePage {
  constructor(private readonly page: Page) {}

  async changeCompanyId(companyId: string): Promise<void> {
    const companyIcon = this.page.locator('#compDiv').getByRole('img');
    await this.clickWithFallback(companyIcon);

    const companyDialog = await this.getCompanyDialogFrame();

    const radioById = companyDialog.locator('#radio2');
    if (await radioById.isVisible().catch(() => false)) {
      await radioById.check().catch(async () => this.clickWithFallback(radioById));
    }

    const inputValue = companyDialog.locator('#InputValue');
    await this.clickWithFallback(inputValue);
    await inputValue.fill(companyId, { timeout: 3_000 });
    await inputValue.press('Enter', { timeout: 3_000 }).catch(() => {});
    await inputValue.press('Tab', { timeout: 3_000 }).catch(() => {});

    await this.clickFirstVisible([
      companyDialog.getByRole('button', { name: /^ok$/i }).first(),
      companyDialog.locator('#OK, #ok, input[value="OK"], button:has-text("OK")').first(),
      this.page.getByRole('button', { name: /^ok$/i }).first(),
      this.page.locator('#OK, #ok, input[value="OK"], button:has-text("OK")').first(),
    ]);

  }

  private async getCompanyDialogFrame(): Promise<FrameLocator> {
    const iframeCandidates = [
      this.page.locator('iframe[name="_dlgOpenerIframe1"]').first(),
      this.page.locator('iframe[name^="_dlgOpenerIframe"]').first(),
      this.page.locator('iframe[id^="_dlgOpenerIframe"]').first(),
    ];

    for (const iframe of iframeCandidates) {
      if (await iframe.isVisible().catch(() => false)) {
        return iframe.contentFrame();
      }
    }

    return this.page.locator('iframe[name="_dlgOpenerIframe1"]').first().contentFrame();
  }

  private async clickFirstVisible(candidates: Locator[]): Promise<void> {
    for (const candidate of candidates) {
      if (!(await candidate.isVisible().catch(() => false))) continue;
      await this.clickWithFallback(candidate);
      return;
    }
  }

  private async clickWithFallback(locator: Locator): Promise<void> {
    await locator.click({ timeout: 3_000 }).catch(async () => {
      await locator.click({ force: true, timeout: 3_000 });
    });
  }
}
