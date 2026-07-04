import { test } from '../fixtures/testFixture';
import { APHomePage } from '@poms/AP_Home_Page';
import { SmartAPListPage } from '@poms/SmartAP_List_Page';
import { SmartApDetailPage } from '@poms/SmartAp_Detail_Page';

test.describe('SmartAP List Page', () => {
  test('test', async ({ page }) => {
    // Step 1: Initialize page objects and test data.
    const apHomePage = new APHomePage(page);
    const smartAPListPage = new SmartAPListPage(page);
    const smartApDetailPage = new SmartApDetailPage(page);
    const companyId = String(process.env.TARGET_COMPANY_ID || '931').trim();

    // Step 2: Open home page and switch to target company.
    await smartApDetailPage.openHomePage();
    await apHomePage.changeCompanyId(companyId);

    // Step 3: Open AP Invoice from Quick Links.
    await smartAPListPage.openApInvoiceFromQuickLinks();
  });
});
