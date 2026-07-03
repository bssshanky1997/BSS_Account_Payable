import { test as base } from '@playwright/test';
import { ApiHelper } from '../utils/apiHelper';
import { PositionRightsApi } from '../utils/positionRightsApi';
import { getScreenshotPathForTest, getTestCaseFolderName } from '../utils/screenshotPath';

type BssFixtures = {
  apiHelper: ApiHelper;
  positionRightsApi: PositionRightsApi;
};

async function captureScreenshotAfterTest(
  page: import('@playwright/test').Page,
  testInfo: import('@playwright/test').TestInfo
): Promise<void> {
  if (testInfo.status === 'skipped') return;

  const testCaseFolder = getTestCaseFolderName(testInfo.title, testInfo.file);
  const screenshotPath = getScreenshotPathForTest(testCaseFolder, `${testInfo.title}-${testInfo.status}`);

  try {
    const activePage = page.isClosed() ? page.context().pages().at(-1) : page;
    if (!activePage || activePage.isClosed()) return;
    await activePage.screenshot({ path: screenshotPath, fullPage: true });
  } catch {
    // Keep tests stable even if screenshot capture fails.
  }
}

function withApiFixture<T extends { init: () => Promise<void>; dispose: () => Promise<void> }>(
  createApi: () => T
) {
  return async ({}, use: (value: T) => Promise<void>): Promise<void> => {
    const api = createApi();
    await api.init();
    await use(api);
    await api.dispose();
  };
}

export const test = base.extend<BssFixtures>({
  page: async ({ page }, use, testInfo) => {
    await use(page);
    await captureScreenshotAfterTest(page, testInfo);
  },
  apiHelper: withApiFixture(() => new ApiHelper()),
  positionRightsApi: withApiFixture(() => new PositionRightsApi()),
});

export { expect } from '@playwright/test';
