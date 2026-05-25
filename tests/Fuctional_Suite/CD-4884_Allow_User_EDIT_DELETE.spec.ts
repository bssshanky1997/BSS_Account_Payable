import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  await page.goto('https://appqa.birchstreet.co/j4/login.jsp');
  await page.waitForLoadState('domcontentloaded');
  await page.locator('#loginID').click();
  await page.locator('#loginID').fill('bss_shpandey');
  await page.locator('#password').click();
  await page.locator('#password').fill('Reset1234');
  await page.locator('#subscriberID').click();
  await page.locator('#subscriberID').fill('641');
  await page.getByRole('button', { name: 'Login' }).click();
  await page.waitForLoadState('networkidle');

  const quickLinksButton = page.locator('#quickLinks1');
  await expect(quickLinksButton).toBeVisible({ timeout: 20000 });
  await quickLinksButton.click();

  const apInvoiceButton = page.getByRole('button', { name: 'AP Invoice' });
  await expect(apInvoiceButton).toBeVisible({ timeout: 20000 });
  await apInvoiceButton.click();
  await page.waitForLoadState('networkidle');

  await page.getByRole('img', { name: 'Actions' }).first().click();
  await page.locator('div').filter({ hasText: /^Notes$/ }).click();

  const notesFrame = page.locator('#notesIframe').contentFrame();
  await expect(notesFrame.locator('#commentTextarea')).toBeVisible({ timeout: 20000 });
  await notesFrame.locator('#commentTextarea').click();
  await notesFrame.locator('#commentTextarea').fill('Test');
  await notesFrame.locator('#commentForm a.attacheImg').click();
  await expect(notesFrame.locator('#fileInputTemp')).toBeAttached({ timeout: 20000 });
  await notesFrame.locator('#fileInputTemp').setInputFiles('tests/Fuctional_Suite/attachment.txt');
  await expect(notesFrame.getByRole('button', { name: 'Add Attachment' })).toBeEnabled({ timeout: 20000 });
  await notesFrame.getByRole('button', { name: 'Add Attachment' }).click();
  await expect(notesFrame.getByRole('button', { name: 'Post' })).toBeEnabled({ timeout: 20000 });
  await notesFrame.getByRole('button', { name: 'Post' }).click();
});
