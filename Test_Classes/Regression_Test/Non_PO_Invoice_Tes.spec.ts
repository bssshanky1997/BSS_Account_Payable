import { test, expect } from '@playwright/test';
import { APHomePage } from '@poms/Regression_Test/AP_Home_Page';
import { SmartAPListPage } from '@poms/Regression_Test/SmartAP_List_Page';
import { NonPOInvoicePage } from '@poms/Regression_Test/SmartAP_Detail_Page';

test('test', async ({ page }) => {
  // Step 1: Initialize page objects and open home page.
  const apHomePage = new APHomePage(page);
  const smartAPListPage = new SmartAPListPage(page);
  const nonPOInvoicePage = new NonPOInvoicePage(page);
  await page.goto('/j4/default.jsp');

  // Step 2: Validate company widget and switch to target company.
  await expect(page.locator('#compDiv')).toBeVisible();
  await apHomePage.changeCompanyId('931');

  // Step 3: Open AP Invoice from Quick Links.
  await smartAPListPage.openApInvoiceFromQuickLinks();

  // Step 4: Create a new Non-PO invoice from scratch.
  await nonPOInvoicePage.createInvoiceFromScratch();
});
