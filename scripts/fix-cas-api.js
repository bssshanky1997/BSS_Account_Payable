const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const { chromium, request } = require('@playwright/test');

dotenv.config({ path: path.resolve(__dirname, '..', '.env'), override: true });

const LOGIN_PATH = '/j4/login.jsp';
const AUTH_PATH = path.resolve(__dirname, '..', 'playwright', '.auth', 'user.json');
const OUT_DIR = path.resolve(__dirname, '..', 'test-results');

async function refreshAuth() {
  const baseUrl = String(process.env.BASE_URL || 'https://appqa.birchstreet.co').trim();
  const username = process.env.USERNAME;
  const password = process.env.PASSWORD;
  const subscriberId = process.env.SUBSCRIBER_ID;
  if (!username || !password || !subscriberId) {
    throw new Error('Missing USERNAME/PASSWORD/SUBSCRIBER_ID');
  }

  fs.mkdirSync(path.dirname(AUTH_PATH), { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();
  try {
    await page.goto(new URL(LOGIN_PATH, baseUrl).toString(), { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.locator('#loginID').fill(username);
    await page.locator('#password').fill(password);
    await page.locator('#subscriberID').fill(subscriberId);
    const loginButton = page.locator('#submitLogin').first();
    if (await loginButton.isVisible().catch(() => false)) {
      await loginButton.click({ noWaitAfter: true });
    } else {
      await page.getByRole('button', { name: 'Login' }).click({ noWaitAfter: true });
    }

    const deadline = Date.now() + 60_000;
    while (Date.now() < deadline) {
      const ok =
        (await page.locator('#compDiv').isVisible().catch(() => false)) ||
        (await page.locator('#quickLinks1, #quickLinks2').first().isVisible().catch(() => false)) ||
        !page.url().includes(LOGIN_PATH);
      if (ok && !page.url().includes(LOGIN_PATH)) break;
      await page.waitForTimeout(500);
    }

    await context.storageState({ path: AUTH_PATH });
    console.log(`AUTH_SAVED=${AUTH_PATH}`);
    console.log(`AUTH_URL=${page.url()}`);
  } finally {
    await browser.close();
  }
}

async function probeCas() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const baseURL = new URL('/j4/', process.env.BASE_URL || 'https://appqa.birchstreet.co').toString();
  const companyId = String(process.env.TARGET_COMPANY_ID || '931').trim();
  const ctx = await request.newContext({
    baseURL,
    storageState: AUTH_PATH,
    ignoreHTTPSErrors: true,
    timeout: 60_000,
  });

  try {
    const screen = await ctx.get('agscreen.jsp?screenid=10292');
    const html = await screen.text();
    fs.writeFileSync(path.join(OUT_DIR, 'cas-screen-10292.html'), html);
    console.log(`SCREEN status=${screen.status()} len=${html.length} unauthorized=${/401|Unauthorized|login\.jsp/i.test(html)}`);

    const ids = [
      ...html.matchAll(/gDocID\s*=\s*["'](\d+)["']/gi),
      ...html.matchAll(/DOCTYPE:(\d+)/gi),
      ...html.matchAll(/documentID["'\s:=]+(\d+)/gi),
      ...html.matchAll(/DocumentLoad\.jsp[^"']*documentID=(\d+)/gi),
      ...html.matchAll(/var\s+docID\s*=\s*["']?(\d+)/gi),
      ...html.matchAll(/document_id["'\s:=]+(\d+)/gi),
      ...html.matchAll(/doctype["'\s:=]+(\d+)/gi),
    ].map((m) => m[1]);
    console.log(`SCREEN_DOC_IDS=${[...new Set(ids)].join(',') || 'none'}`);

    // Prefer ids found on screen, then common range
    const candidates = [
      ...new Set([
        ...ids,
        process.env.DOC_ID_COMPANY_APPLICATION_SETTING,
        ...Array.from({ length: 120 }, (_, i) => String(i + 1)),
      ].filter(Boolean)),
    ];

    const hits = [];
    for (const documentID of candidates) {
      const res = await ctx.post('DocumentLoad.jsp', {
        form: {
          documentNumber: companyId,
          documentID: String(documentID),
          StateID: '1',
          loadXML: '<FOREIGN_KEY_DESC></FOREIGN_KEY_DESC>',
          doLoad: '1',
        },
      });
      const text = await res.text();
      if (!/DocDataObject|RSObject|SetByList/i.test(text)) continue;

      const tables = [...text.matchAll(/var\s+([A-Z0-9_]+)\s*=\s*new\s+RSObject\(/g)].map((m) => m[1]);
      const tax = /SHOW_TAX|TAX_LEVEL|TAX_TYPE|TAX_AUTHORITY|PSM_APP_SETTING|DEPARTMENT_FOR_TAX|USE_TAX_DEPT/i.test(text);
      const hit = { documentID, tables, tax, len: text.length };
      hits.push(hit);
      console.log(`HIT docId=${documentID} tables=${tables.join('|')} tax=${tax} len=${text.length}`);
      fs.writeFileSync(path.join(OUT_DIR, `cas-docload-${documentID}.js.txt`), text);

      if (tax) {
        const colnames = [...text.matchAll(/SetColNames\("([\s\S]*?)"\s*,\s*"~;~"\)/g)].map((m) => m[1].slice(0, 500));
        const rows = [...text.matchAll(/([A-Z0-9_]+)\.SetByList\("([\s\S]*?)",\s*"~;~"\)/g)];
        console.log(`  colnames_samples=${colnames.length}`);
        for (const c of colnames.slice(0, 2)) console.log(`  COLNAMES=${c}`);
        for (const match of rows.slice(0, 2)) {
          console.log(`  ROW ${match[1]} => ${match[2].slice(0, 400)}`);
        }
      }
    }

    fs.writeFileSync(path.join(OUT_DIR, 'cas-docload-hits.json'), JSON.stringify(hits, null, 2));
    console.log(`TOTAL_HITS=${hits.length}`);
  } finally {
    await ctx.dispose();
  }
}

(async () => {
  await refreshAuth();
  await probeCas();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
