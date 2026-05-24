import { test as base } from '@playwright/test';
import { ApiHelper } from '../utils/apiHelper';
import { getScreenshotPathForTest, getTestCaseFolderName } from '../utils/screenshotPath';

/**
 * Custom test fixtures for BSS Account Payable
 *
 * Usage in tests:
 *   import { test, expect } from '../fixtures/testFixture';
 *   test('my test', async ({ page }) => { ... });
 *
 * Add page object fixtures here as you create them.
 */

// Extend the fixture types
type BssFixtures = {
  apiHelper: ApiHelper;
};

export const test = base.extend<BssFixtures>({
  /** Page fixture - captures a screenshot after each non-skipped test */
  page: async ({ page }, use, testInfo) => {
    await use(page);

    if (testInfo.status === 'skipped') return;
    const testCaseFolder = getTestCaseFolderName(testInfo.title, testInfo.file);
    const screenshotPath = getScreenshotPathForTest(
      testCaseFolder,
      `${testInfo.title}-${testInfo.status}`
    );

    try {
      // Some flows close the original fixture page and continue in a newly opened tab/window.
      const activePage = page.isClosed() ? page.context().pages().at(-1) : page;
      if (!activePage || activePage.isClosed()) return;
      await activePage.screenshot({ path: screenshotPath, fullPage: true });
    } catch {
      // Ignore screenshot failures so tests do not fail due to capture issues.
    }
  },

  /** ApiHelper fixture - auto-initializes and disposes */
  apiHelper: async ({}, use) => {
    const api = new ApiHelper();
    await api.init();
    await use(api);
    await api.dispose();
  },
});

export { expect } from '@playwright/test';
