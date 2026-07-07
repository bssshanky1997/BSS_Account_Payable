import { test, expect } from '@playwright/test';
import { APHomePage } from '@poms/Regression_Test/AP_Home_Page';

test('test', async ({ page }) => {
  // Step 1: Initialize AP Home page object and open home page.
  const apHomePage = new APHomePage(page);
  await page.goto('/j4/default.jsp');

  // Step 2: Validate company widget and switch to target company.
  await expect(page.locator('#compDiv')).toBeVisible();
  await apHomePage.changeCompanyId('931');
});
