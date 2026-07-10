const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const { request } = require('@playwright/test');

dotenv.config({ path: path.resolve(__dirname, '..', '.env'), override: true });

async function main() {
  const ctx = await request.newContext({
    baseURL: new URL('/j4/', process.env.BASE_URL || 'https://appqa.birchstreet.co').toString(),
    storageState: path.resolve(__dirname, '..', 'playwright/.auth/user.json'),
    ignoreHTTPSErrors: true,
  });
  try {
    const html = await (await ctx.get('agscreen.jsp?screenid=10292')).text();
    fs.mkdirSync(path.resolve(__dirname, '..', 'test-results'), { recursive: true });
    fs.writeFileSync(path.resolve(__dirname, '..', 'test-results/cas-screen.html'), html);

    const fields = [];
    const re = /FIELD\[(\d+)\]\s*=\s*new FieldObject\(([\s\S]*?)\);/g;
    let m;
    while ((m = re.exec(html)) !== null) {
      const parts = [...m[2].matchAll(/"([^"]*)"/g)].map((x) => x[1]);
      fields.push({ idx: m[1], col: parts[6] || '', label: parts[7] || '' });
    }
    const hits = fields.filter((f) =>
      /TAX_TYPE|SHOW_TAX_LEVEL|TAX_LEVEL_[1-4]|TAX_AUTH/i.test(`${f.col} ${f.label}`)
    );
    console.log(JSON.stringify(hits, null, 2));

    // Find select/input for tax type in HTML
    const taxSelect = html.match(/id="(FIELD\d+)"[^>]*(?:name="FIELD\d+")?[^>]*>[\s\S]{0,400}Tax Authority|Tax type|TAX_TYPE/i);
    console.log('taxSelect snippet', taxSelect && taxSelect[0].slice(0, 300));

    const field145 = html.match(/id="FIELD145"[\s\S]{0,500}/);
    console.log('FIELD145', field145 && field145[0].slice(0, 400));
  } finally {
    await ctx.dispose();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
