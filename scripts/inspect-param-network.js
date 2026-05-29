const path = require('path');
const dotenv = require('dotenv');
const { chromium } = require('@playwright/test');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

async function run() {
  const baseUrl = process.env.BASE_URL || 'https://appqa.birchstreet.co';
  const targetUrl = `${baseUrl}/j4/agscreen.jsp?screenid=10806&dt=${Date.now()}`;
  const headless = String(process.env.HEADLESS || 'false').toLowerCase() === 'true';

  const browser = await chromium.launch({
    headless,
    args: ['--start-maximized', '--disable-dev-shm-usage', '--disable-gpu'],
  });
  const context = await browser.newContext({
    storageState: 'playwright/.auth/user.json',
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();

  const interesting = [];
  const capture = (prefix, url, statusOrError) => {
    const text = `${prefix} ${url} -> ${statusOrError}`;
    if (
      /DocumentLoad\.jsp|DocumentSave\.jsp|agscreen\.jsp|grid|ajax|integration|parameter|j4\/api|load/i.test(
        url
      )
    ) {
      interesting.push(text);
    }
  };

  page.on('response', (res) => capture('RES', res.url(), res.status()));
  page.on('requestfailed', (req) =>
    capture('FAIL', req.url(), req.failure()?.errorText || 'unknown')
  );

  await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  await page.waitForTimeout(8000);

  console.log(`finalUrl=${page.url()}`);
  console.log('--- network ---');
  for (const line of interesting.slice(0, 200)) console.log(line);

  await context.close();
  await browser.close();
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
