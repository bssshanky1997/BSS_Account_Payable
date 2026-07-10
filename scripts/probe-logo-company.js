const path = require('path');
const dotenv = require('dotenv');
const { chromium } = require('@playwright/test');

dotenv.config({ path: path.resolve(__dirname, '..', '.env'), override: true });

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    storageState: path.resolve(__dirname, '..', 'playwright/.auth/user.json'),
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();
  await page.goto(new URL('/j4/default.jsp', process.env.BASE_URL || 'https://appqa.birchstreet.co').toString(), {
    waitUntil: 'domcontentloaded',
    timeout: 60_000,
  });
  await page.waitForTimeout(3000);

  const logo = page.frame({ name: 'Logo' });
  if (!logo) throw new Error('Logo frame missing');

  const mkt = await logo.locator('text=/Mktplc/').first().innerText().catch(() => '');
  console.log('mkt text', mkt);

  const allImgs = await logo.locator('img').evaluateAll((els) =>
    els.map((e) => ({
      id: e.id,
      title: e.title,
      alt: e.alt,
      src: (e.getAttribute('src') || '').slice(-80),
      onclick: (e.getAttribute('onclick') || '').slice(0, 160),
      parentOnclick: (e.parentElement && e.parentElement.getAttribute('onclick')) || '',
    }))
  );
  console.log('imgs', JSON.stringify(allImgs, null, 2));

  const clickables = await logo.locator('a, img, span, td, input').evaluateAll((els) =>
    els
      .filter((e) => (e.getAttribute('onclick') || '').length > 0 || (e.getAttribute('href') || '').includes('javascript'))
      .slice(0, 40)
      .map((e) => ({
        tag: e.tagName,
        id: e.id,
        text: (e.innerText || '').slice(0, 40),
        onclick: (e.getAttribute('onclick') || '').slice(0, 160),
        href: (e.getAttribute('href') || '').slice(0, 120),
      }))
  );
  console.log('clickables', JSON.stringify(clickables, null, 2));

  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
