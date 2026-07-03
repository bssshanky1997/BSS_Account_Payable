import { test } from '../fixtures/testFixture';
import { APHomePage } from '@poms/AP_Home_Page';

test.describe('Smart AP - AP Invoice', () => {
  test('PROMPT 1 — Bulk Submit visible (permission + Smart AP)', async ({ page }) => {
    const apHomePage = new APHomePage(page);
    const companyId = String(process.env.TARGET_COMPANY_ID || '931').trim();

    await test.step('Step 1: Login into subscriber 641 and company 2', async () => {
      await apHomePage.openHomePage();
      await apHomePage.changeCompanyId(companyId);
    });

    await test.step('Step 2: Click AP Invoice page', async () => {
      await apHomePage.openApInvoicePage();
    });

    await test.step('Step 3: Verify Batch/Bulk Submit button is visible', async () => {
      await apHomePage.verifyBulkSubmitVisible();
    });
  });
});
