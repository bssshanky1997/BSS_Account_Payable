import { test } from '../fixtures/testFixture';
import { APHomePage } from '@poms/AP_Home_Page';

test.describe('AP Home Page', () => {
  test('Change company from AP Home page', async ({ page }) => {
    const apHomePage = new APHomePage(page);
    const companyId = String(process.env.TARGET_COMPANY_ID || '931').trim();

    // Step 1: Open home page.
    await test.step('Step 1: Open home page and login if needed', async () => {
      await page.goto('/j4/default.jsp');
      await page.waitForLoadState('domcontentloaded');
    });

    // Step 2: Change company using company switcher dialog.
    await test.step('Step 2: Change company from company switcher dialog', async () => {
      await apHomePage.changeCompanyId(companyId);
    });
  });
});
