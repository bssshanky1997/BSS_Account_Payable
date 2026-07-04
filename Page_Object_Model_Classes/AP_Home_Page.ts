import { expect, type Page } from '@playwright/test';

export class APHomePage {
  constructor(private readonly page: Page) {}

  async changeCompanyId(companyId: string): Promise<void> {
    // Step 1: Open company search dialog from AP home header.
    const companyPickerIcon = this.page.locator('#compDiv').getByRole('img');
    await companyPickerIcon.waitFor({ state: 'visible', timeout: 15_000 });
    await companyPickerIcon.click();

    // Step 2: Search by company ID and confirm selection.
    const dialogIframe = this.page.locator('iframe[name="_dlgOpenerIframe1"]');
    await dialogIframe.waitFor({ state: 'visible', timeout: 15_000 });
    const dialogFrame = this.page.frameLocator('iframe[name="_dlgOpenerIframe1"]');
    const companyIdRadio = dialogFrame.locator('#radio2');
    await companyIdRadio.waitFor({ state: 'visible', timeout: 15_000 });
    await companyIdRadio.check();

    const inputValue = dialogFrame.locator('#InputValue');
    await inputValue.waitFor({ state: 'visible', timeout: 15_000 });
    await inputValue.click();
    await inputValue.press('Control+A');
    await inputValue.press('Delete');
    await inputValue.type(companyId);
    await inputValue.press('Tab');

    const okButton = dialogFrame.getByRole('button', { name: 'OK' });
    await okButton.waitFor({ state: 'visible', timeout: 15_000 });
    await expect(okButton).toBeEnabled({ timeout: 10_000 });
    await okButton.click();
  }
}
