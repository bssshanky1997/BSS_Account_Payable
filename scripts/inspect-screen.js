const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const { request } = require('@playwright/test');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

async function run() {
  const screenId = process.argv[2] || '10267';
  const keywords = ['2097', 'param', 'DocumentSave.jsp', 'DocumentLoad.jsp', 'agscreen.jsp', 'right'];
  const baseUrl = process.env.BASE_URL || 'https://appqa.birchstreet.co';

  const ctx = await request.newContext({
    baseURL: new URL('/j4/', baseUrl).toString(),
    storageState: 'playwright/.auth/user.json',
    ignoreHTTPSErrors: true,
    timeout: 60_000,
  });

  try {
    const res = await ctx.get(`agscreen.jsp?screenid=${screenId}`);
    const html = await res.text();
    const outPath = path.resolve(__dirname, '..', 'test-results', `screen-${screenId}.html`);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, html, 'utf8');
    const gDocMatch = html.match(/var\s+gDocID\s*=\s*"(\d+)"/);
    const docTypeMatch = html.match(/DOCTYPE:(\d+)/);
    const stateMatch = html.match(/var\s+gStateID\s*=\s*"(\d+)"/);

    console.log(`status=${res.status()}`);
    console.log(`screenId=${screenId}`);
    console.log(`gDocID=${gDocMatch ? gDocMatch[1] : 'n/a'}`);
    console.log(`docTypeMeta=${docTypeMatch ? docTypeMatch[1] : 'n/a'}`);
    console.log(`stateId=${stateMatch ? stateMatch[1] : 'n/a'}`);
    console.log(`savedHtml=${outPath}`);

    for (const keyword of keywords) {
      const idx = html.toLowerCase().indexOf(keyword.toLowerCase());
      if (idx === -1) continue;
      const start = Math.max(0, idx - 120);
      const end = Math.min(html.length, idx + 220);
      console.log(`\nkeyword=${keyword}`);
      console.log(html.slice(start, end).replace(/\s+/g, ' '));
    }
  } finally {
    await ctx.dispose();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
