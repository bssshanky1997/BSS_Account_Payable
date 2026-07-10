const path = require('path');
const dotenv = require('dotenv');
const { chromium } = require('@playwright/test');

dotenv.config({ path: path.resolve(__dirname, '..', '.env'), override: true });

async function main() {
  const browser = await chromium.launch({ headless: false, args: ['--start-maximized'] });
  const context = await browser.newContext({
    storageState: path.resolve(__dirname, '..', 'playwright/.auth/user.json'),
    ignoreHTTPSErrors: true,
    viewport: null,
  });
  const page = await context.newPage();
  await page.goto(new URL('/j4/default.jsp', process.env.BASE_URL || 'https://appqa.birchstreet.co').toString(), {
    waitUntil: 'domcontentloaded',
    timeout: 60_000,
  });
  await page.waitForTimeout(3000);

  const selects = await page.locator('select').evaluateAll((els) =>
    els.map((e) => ({
      id: e.id,
      name: e.name,
      cls: String(e.className || '').slice(0, 80),
      value: e.value,
      options: Array.from(e.options)
        .slice(0, 20)
        .map((o) => ({ value: o.value, text: o.text.slice(0, 80), selected: o.selected })),
      optionCount: e.options.length,
    }))
  );
  console.log('selects', JSON.stringify(selects, null, 2));

  // Find select that has 55396 selected
  const companySelect = page.locator('select').filter({ has: page.locator('option[value="55396"]') }).first();
  console.log('company select count', await companySelect.count());
  if ((await companySelect.count()) > 0) {
    const options = await companySelect.locator('option').evaluateAll((els) =>
      els.map((o) => ({ value: o.value, text: o.textContent.slice(0, 80) }))
    );
    console.log('all options sample', options.slice(0, 30));
    const has931 = options.some((o) => o.value === '931' || /\b931\b/.test(o.text));
    console.log('has931', has931);

    // Try select by value 931
    if (has931) {
      await companySelect.selectOption('931');
      await page.waitForTimeout(3000);
      console.log('after select URL', page.url());
      console.log('selected', await companySelect.inputValue());
      const body = await page.locator('body').innerText();
      console.log('body has 931?', /931/.test(body));
      console.log('body has 55396?', /55396/.test(body));
    }
  }

  // Also check for search glass near select
  const near = await page.locator('select').first().evaluate((el) => {
    const parent = el.closest('div, nav, form') || el.parentElement;
    return parent
      ? {
          html: parent.innerHTML.slice(0, 800),
          text: (parent.innerText || '').slice(0, 200),
        }
      : null;
  });
  console.log('near select', near);

  await page.screenshot({ path: 'test-results/probe-select-company.png', fullPage: true });
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
