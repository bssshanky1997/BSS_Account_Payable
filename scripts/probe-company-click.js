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

  const companyControl = page.locator('text=/L00044920|Warren County/i').first();
  console.log('company visible', await companyControl.isVisible().catch(() => false));

  // Find clickable ancestor
  const clickTarget = page
    .locator('button, a, [role="button"], .dropdown-toggle, [data-toggle], [onclick]')
    .filter({ hasText: /L00044920|Warren County/i })
    .first();
  const hasClickable = await clickTarget.isVisible().catch(() => false);
  console.log('clickable', hasClickable);

  if (hasClickable) {
    await clickTarget.click();
  } else {
    await companyControl.click();
  }
  await page.waitForTimeout(1500);

  // After click, dump visible dialog/menu content
  const dialogs = await page.locator('.modal, .dropdown-menu, [role="dialog"], iframe').evaluateAll((els) =>
    els.slice(0, 20).map((e) => ({
      tag: e.tagName,
      id: e.id,
      cls: String(e.className || '').slice(0, 80),
      name: e.getAttribute('name'),
      text: (e.innerText || '').slice(0, 200),
      visible: !!(e.offsetWidth || e.offsetHeight),
    }))
  );
  console.log('dialogs', JSON.stringify(dialogs, null, 2));
  console.log(
    'frames after click',
    page.frames().map((f) => ({ name: f.name(), url: f.url().slice(0, 100) }))
  );

  // Try typing 931 in any visible input
  const input = page.locator('#InputValue, input[type="text"], input[type="search"]').first();
  if (await input.isVisible().catch(() => false)) {
    console.log('found input');
    await input.fill('931');
    await input.press('Enter');
    await page.waitForTimeout(1500);
  }

  // Check iframe dialogs
  for (const frame of page.frames()) {
    if (!frame.url().includes('dlg') && !frame.name().includes('dlg')) continue;
    console.log('dlg frame', frame.name(), frame.url().slice(0, 120));
    const radio = frame.locator('#radio2');
    console.log('radio2', await radio.count());
    const inp = frame.locator('#InputValue');
    console.log('InputValue', await inp.count());
  }

  await page.screenshot({ path: 'test-results/probe-company-click.png', fullPage: true });
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
