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
  await page.waitForTimeout(4000);

  console.log('URL', page.url());
  console.log('title', await page.title());
  console.log(
    'frames',
    page.frames().map((f) => f.name()).filter(Boolean).slice(0, 20)
  );

  const welcome = await page.getByText(/Welcome,/i).isVisible().catch(() => false);
  const mktplc = await page.locator('text=/Mktplc/i').count().catch(() => 0);
  const logoFrame = page.frames().some((f) => f.name() === 'Logo');
  console.log({ welcome, mktplc, logoFrame });

  // Candidate company/location controls on new UI
  const candidates = [
    'text=/Warren County/i',
    'text=/L00044920/i',
    '[class*="company" i]',
    '[class*="location" i]',
    '[aria-label*="company" i]',
    '[aria-label*="location" i]',
    'button:has-text("L0")',
    'div:has-text("L000")',
  ];
  for (const sel of candidates) {
    const loc = page.locator(sel).first();
    const visible = await loc.isVisible().catch(() => false);
    if (visible) {
      const text = ((await loc.innerText().catch(() => '')) || '').slice(0, 80);
      console.log('VISIBLE', sel, text);
    }
  }

  // Dump top header HTML-ish via evaluate
  const headerInfo = await page.evaluate(() => {
    const texts = [];
    const walk = (el, depth = 0) => {
      if (!el || depth > 4) return;
      const t = (el.innerText || '').trim();
      if (t && /L0\d+|Warren|company|Mktplc|641|931|55396/i.test(t) && t.length < 200) {
        texts.push({
          tag: el.tagName,
          id: el.id,
          cls: String(el.className || '').slice(0, 80),
          text: t.slice(0, 120),
        });
      }
      for (const child of Array.from(el.children || []).slice(0, 30)) walk(child, depth + 1);
    };
    walk(document.body);
    return texts.slice(0, 30);
  });
  console.log('headerInfo', JSON.stringify(headerInfo, null, 2));

  // Click world/globe or company dropdown if present
  const globe = page.locator('img[src*="globe" i], img[title*="company" i], [class*="globe" i], button, a').filter({ hasText: '' });
  await page.screenshot({ path: 'test-results/probe-new-home.png', fullPage: true });

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
