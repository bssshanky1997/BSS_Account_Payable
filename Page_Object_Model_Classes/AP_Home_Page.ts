import { type Page } from '@playwright/test';

export class APHomePage {
  constructor(private readonly page: Page) {}

  async changeCompanyId(companyId: string): Promise<void> {
    // Step 1: Open company switcher icon.
    const companyIcon = this.page.locator('#compDiv').getByRole('img').first();
    await companyIcon.waitFor({ state: 'visible', timeout: 20_000 });
    await companyIcon.click().catch(async () => {
      await companyIcon.click({ force: true });
    });

    // Step 2: Wait for company dialog iframe and attach frame.
    const dialogIframe = this.page
      .locator('iframe[name="_dlgOpenerIframe1"], iframe[name^="_dlgOpenerIframe"], iframe[id^="_dlgOpenerIframe"]')
      .first();
    await dialogIframe.waitFor({ state: 'visible', timeout: 7_000 });
    const dialogFrame = dialogIframe.contentFrame();

    // Step 3: Select company-id radio mode when present.
    const radioById = dialogFrame.locator('#radio2').first();
    if (await radioById.isVisible().catch(() => false)) {
      await radioById.check().catch(async () => {
        await radioById.click({ force: true });
      });
    }

    // Step 4: Enter target company id and trigger field validation.
    const inputValue = dialogFrame.locator('#InputValue').first();
    await inputValue.waitFor({ state: 'visible', timeout: 7_000 });
    await inputValue.click().catch(async () => {
      await inputValue.click({ force: true });
    });
    await inputValue.fill(companyId);
    await inputValue.press('Enter').catch(() => {});
    await inputValue.press('Tab').catch(() => {});

    // Step 5: Submit with OK button; fallback to force click and Enter.
    await dialogFrame.getByRole('button', { name: /^ok$/i }).first().click({ timeout: 4_000 }).catch(async () => {
      await dialogFrame
        .locator('#OK, #ok, input[value="OK"], button:has-text("OK")')
        .first()
        .click({ force: true, timeout: 4_000 })
        .catch(async () => {
          await inputValue.press('Enter').catch(() => {});
        });
    });

    // Step 6: Wait for dialog to close.
    await dialogIframe.waitFor({ state: 'hidden', timeout: 4_000 }).catch(() => {});
  }
}
