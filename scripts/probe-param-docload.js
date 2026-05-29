const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const { request } = require('@playwright/test');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

async function run() {
  const baseURL = new URL('/j4/', process.env.BASE_URL || 'https://appqa.birchstreet.co').toString();
  const ctx = await request.newContext({
    baseURL,
    storageState: 'playwright/.auth/user.json',
    ignoreHTTPSErrors: true,
    timeout: 60_000,
  });

  try {
    const res = await ctx.post('DocumentLoad.jsp', {
      form: {
        documentNumber: process.env.CD4884_PARAM_ID || '2097',
        documentID: process.env.CD4884_PARAM_DOCUMENT_ID || '28',
        StateID: process.env.CD4884_PARAM_STATE_ID || '18',
        doLoad: '1',
      },
    });

    const text = await res.text();
    const actionMatch = text.match(/<form[^>]*action="([^"]+)"/i);
    const inputMatches = [...text.matchAll(/name="([^"]+)"\s+value="([^"]*)"/gi)].map(
      (m) => `${m[1]}=${m[2]}`
    );
    const hasDocData = /DocDataObject/.test(text);
    const hasSetByList = /SetByList/.test(text);
    const outPath = path.resolve(__dirname, '..', 'test-results', 'param-docload-response.html');
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, text, 'utf8');

    console.log(`status=${res.status()}`);
    console.log(`hasDocData=${hasDocData}`);
    console.log(`hasSetByList=${hasSetByList}`);
    console.log(`formAction=${actionMatch ? actionMatch[1] : 'n/a'}`);
    console.log(`formInputs=${inputMatches.join(',') || 'none'}`);
    console.log(`savedHtml=${outPath}`);
    console.log(`snippet=${text.slice(0, 600).replace(/\s+/g, ' ')}`);
  } finally {
    await ctx.dispose();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
