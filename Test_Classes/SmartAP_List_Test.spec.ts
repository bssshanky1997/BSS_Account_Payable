import { test } from '../fixtures/testFixture';
import { APHomePage } from '@poms/AP_Home_Page';
import { SmartAPListPage } from '@poms/SmartAP_List_Page';
import { SmartApDetailPage } from '@poms/SmartAp_Detail_Page';

test.describe('SmartAP List Page', () => {
  test('test', async ({ page }) => {
    const apHomePage = new APHomePage(page);
    const smartAPListPage = new SmartAPListPage(page);
    const smartApDetailPage = new SmartApDetailPage(page);
    const companyId = String(process.env.TARGET_COMPANY_ID || '931').trim();

    await smartApDetailPage.openHomePage();
    await apHomePage.changeCompanyId(companyId);
    await smartAPListPage.openApInvoiceFromQuickLinks();
  });
});
