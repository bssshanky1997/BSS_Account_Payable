const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const OUTPUT_DIR = path.resolve(process.cwd(), 'test-results', 'right-capture-flow');
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const now = new Date().toISOString().replace(/[:.]/g, '-');
const outputFile = path.join(OUTPUT_DIR, `capture-${now}.json`);

const captured = [];

const parseForm = (postData) => {
  const params = new URLSearchParams(postData || '');
  return Object.fromEntries(params.entries());
};

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    storageState: 'playwright/.auth/user.json',
    ignoreHTTPSErrors: true,
    viewport: null,
  });
  const page = await context.newPage();

  context.on('request', (req) => {
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method())) return;
    if (!req.url().includes('/j4/')) return;

    // Keep all mutating J4 requests so we can isolate exact Save call.
    const postData = req.postData() || '';
    captured.push({
      timestamp: new Date().toISOString(),
      method: req.method(),
      url: req.url(),
      headers: req.headers(),
      postData,
      formData: parseForm(postData),
    });
  });

  await page.goto('https://appqa.birchstreet.co/j4/agscreen.jsp?screenid=10523', {
    waitUntil: 'domcontentloaded',
    timeout: 60_000,
  });

  // Steps from your snippet.
  await page.getByRole('gridcell', { name: 'AppAdmin' }).click();
  await page.getByRole('gridcell', { name: 'AppAdmin' }).click();
  await page.getByRole('gridcell', { name: 'AppAdmin' }).click({ button: 'right' });
  await page.getByText('Edit', { exact: true }).click();
  await page.getByRole('link', { name: 'Position Rights' }).click();

  // Filter for right 4051
  await page
    .locator(
      '#gridTable0 > .ag-root-wrapper > .ag-root-wrapper-body > .ag-root > .ag-header > .ag-header-viewport > .ag-header-container > .ag-header-row > .ag-header-cell > .ag-cell-label-container > .ag-header-icon.ag-header-cell-menu-button > .ag-icon'
    )
    .click();
  await page.getByPlaceholder('Search...').click();
  await page.getByPlaceholder('Search...').fill('4051');
  await page.getByText('CD 4884 edit and delete notes').click();
  await page.getByText('CD 4884 edit and delete notes').click();
  await page.getByRole('button', { name: 'Apply Filter' }).click();
  await page.getByText('4051 (CD 4884 edit and delete').click();

  // Mark capture boundary before Save click.
  const startIndex = captured.length;
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.waitForTimeout(7000);

  const afterSave = captured.slice(startIndex);
  const saveRelated = afterSave.filter(
    (r) =>
      r.url.includes('/DocumentSave.jsp') ||
      r.url.includes('/DocumentLoad.jsp') ||
      r.url.includes('/AppAjaxRequest.jsp')
  );

  const result = {
    totalCaptured: captured.length,
    capturedAfterSave: afterSave.length,
    saveRelatedCount: saveRelated.length,
    saveRelated,
  };

  fs.writeFileSync(outputFile, JSON.stringify(result, null, 2));

  console.log(`Saved capture: ${outputFile}`);
  console.log(`saveRelatedCount=${saveRelated.length}`);

  await browser.close();
})().catch((error) => {
  console.error('Capture flow failed:', error);
  process.exitCode = 1;
});
