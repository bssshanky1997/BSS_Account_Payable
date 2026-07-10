const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { request } = require('@playwright/test');

dotenv.config({ path: path.resolve(__dirname, '..', '.env'), override: true });

async function load(documentNumber, documentID = '15249') {
  const baseURL = new URL('/j4/', process.env.BASE_URL || 'https://appqa.birchstreet.co').toString();
  const ctx = await request.newContext({
    baseURL,
    storageState: path.resolve(__dirname, '..', 'playwright/.auth/user.json'),
    ignoreHTTPSErrors: true,
    timeout: 60_000,
  });
  try {
    const res = await ctx.post('DocumentLoad.jsp', {
      form: {
        documentNumber: String(documentNumber),
        documentID: String(documentID),
        StateID: '1',
        loadXML: '<FOREIGN_KEY_DESC></FOREIGN_KEY_DESC>',
        doLoad: '1',
      },
    });
    const text = await res.text();
    const rs = text.match(/var\s+PSM_APP_SETTING_COMPANY\s*=\s*new\s+RSObject\((\d+),/);
    const rowMatch = text.match(/PSM_APP_SETTING_COMPANY\.SetByList\("([\s\S]*?)",\s*"~;~"\)/);
    const cells = rowMatch ? rowMatch[1].split('~;~') : [];
    const nonEmpty = cells.map((c, i) => ({ i, c })).filter((x) => x.c && String(x.c).trim() !== '');
    console.log(`docNumber=${documentNumber} status=${res.status()} colCount=${rs && rs[1]} cells=${cells.length} nonEmpty=${nonEmpty.length}`);
    console.log(nonEmpty.slice(0, 40));
    // dump interesting snippets
    const snippets = [...text.matchAll(/.{0,60}(ColName|colnames|COLUMN|TAX_TYPE|COMPANY_ID|SetCol).{0,80}/gi)]
      .slice(0, 20)
      .map((m) => m[0].replace(/\s+/g, ' '));
    console.log('snippets', snippets);
    fs.writeFileSync(`test-results/cas-docload-num-${documentNumber}.js.txt`, text);
    return text;
  } finally {
    await ctx.dispose();
  }
}

(async () => {
  await load('931');
  await load('641');
  // try after reading company from screen cookie context - also 55396
  await load('55396');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
