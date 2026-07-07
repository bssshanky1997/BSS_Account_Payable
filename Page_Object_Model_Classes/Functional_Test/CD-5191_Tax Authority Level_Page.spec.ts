import { expect, type Page } from '@playwright/test';
import { APHomePage } from '../Regression_Test/AP_Home_Page';

export class TaxAuthorityLevelPage {
  private readonly apHomePage: APHomePage;

  constructor(private readonly page: Page) {
    this.apHomePage = new APHomePage(page);
  }

  async openHomeAndSwitchCompany(companyId: string): Promise<void> {
    await this.page.goto('/j4/default.jsp');
    await this.apHomePage.changeCompanyId(companyId);
  }

  async validateHomeLoaded(): Promise<void> {
    await expect(this.page.locator('#compDiv')).toBeVisible();
  }
}
