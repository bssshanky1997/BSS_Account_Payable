import { test } from '../fixtures/testFixture';
import { SmartAPListPage } from '@poms/SmartAP_List_Page';

test.describe('SmartAP List Page', () => {
  test.skip('SmartAP_List_Page: add page-specific test steps', async ({ page }) => {
    const smartAPListPage = new SmartAPListPage(page);
    await smartAPListPage.openSmartAPListPage();
  });
});
