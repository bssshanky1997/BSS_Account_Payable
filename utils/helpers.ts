import { Page, expect, test } from '@playwright/test';
import { COMMON_SELECTORS, TIMEOUTS } from './constants';
import { getScreenshotPathForTest, getTestCaseFolderName } from './screenshotPath';

/**
 * Reusable helper utilities for BSS Account Payable tests
 */

/**
 * Wait for the page loader/spinner to disappear
 */
export async function waitForLoaderToDisappear(page: Page, timeout = TIMEOUTS.LONG): Promise<void> {
  const loader = page.locator(COMMON_SELECTORS.LOADER);
  await loader.waitFor({ state: 'hidden', timeout }).catch(() => {
    // Loader may not appear at all — that's fine
  });
}

/**
 * Wait for a successful toast notification
 */
export async function waitForSuccessToast(page: Page, timeout = TIMEOUTS.MEDIUM): Promise<string> {
  const toast = page.locator(COMMON_SELECTORS.TOAST_SUCCESS);
  await toast.waitFor({ state: 'visible', timeout });
  const message = (await toast.textContent()) || '';
  return message.trim();
}

/**
 * Generate a unique string — useful for invoice numbers, descriptions, etc.
 */
export function generateUniqueId(prefix = 'AUTO'): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 6);
  return `${prefix}_${timestamp}_${random}`.toUpperCase();
}

/**
 * Format a date as MM/DD/YYYY (common BSS date format)
 */
export function formatDate(date: Date = new Date()): string {
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${mm}/${dd}/${yyyy}`;
}

/**
 * Get today's date formatted for BSS inputs
 */
export function getTodayFormatted(): string {
  return formatDate(new Date());
}

/**
 * Get a future date formatted for BSS inputs
 */
export function getFutureDate(daysFromNow: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return formatDate(date);
}

/**
 * Format a number as currency string (e.g. 1234.56 → "1,234.56")
 */
export function formatCurrency(amount: number): string {
  return amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * Confirm a modal dialog by clicking the confirm button
 */
export async function confirmDialog(page: Page): Promise<void> {
  const modal = page.locator(COMMON_SELECTORS.MODAL_DIALOG);
  await modal.waitFor({ state: 'visible', timeout: TIMEOUTS.SHORT });
  await page.locator(COMMON_SELECTORS.CONFIRM_BUTTON).click();
  await modal.waitFor({ state: 'hidden', timeout: TIMEOUTS.SHORT });
}

/**
 * Take a named screenshot and attach it to the test report
 */
export async function takeScreenshot(page: Page, name: string): Promise<Buffer> {
  let currentTestTitle = 'manual_capture';
  let currentTestFilePath: string | undefined;
  try {
    currentTestTitle = test.info().title || currentTestTitle;
    currentTestFilePath = test.info().file;
  } catch {
    // If called outside a test context, keep screenshots grouped in fallback folder.
  }

  const testCaseFolder = getTestCaseFolderName(currentTestTitle, currentTestFilePath);

  return await page.screenshot({
    path: getScreenshotPathForTest(testCaseFolder, name),
    fullPage: true,
  });
}

/**
 * Scroll to the bottom of the page
 */
export async function scrollToBottom(page: Page): Promise<void> {
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(500);
}

/**
 * Retry an action up to maxRetries times
 */
export async function retryAction<T>(
  action: () => Promise<T>,
  maxRetries = 3,
  delayMs = 1000
): Promise<T> {
  let lastError: Error | undefined;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await action();
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }
  throw lastError;
}
