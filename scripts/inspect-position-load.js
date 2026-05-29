const path = require('path');
const dotenv = require('dotenv');
const { request } = require('@playwright/test');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const FK_LOAD_XML =
  '<FOREIGN_KEY_DESC><ROW><CHILD_TABLE>SMPOSITION_RIGHT_DETAIL</CHILD_TABLE><CHILD_COLUMN>RIGHT_ID</CHILD_COLUMN><PARENT_TABLE>SMPOSITION_RIGHT_MASTER</PARENT_TABLE><PARENT_KEY_COLUMN>RIGHT_ID</PARENT_KEY_COLUMN><PARENT_DESC_COLUMN>RIGHT_DESC</PARENT_DESC_COLUMN></ROW></FOREIGN_KEY_DESC>';

async function run() {
  const baseUrl = process.env.BASE_URL || 'https://appqa.birchstreet.co';
  const base = new URL('/j4/', baseUrl).toString();
  const positionId = String(process.env.RIGHTS_POSITION_ID || 2);

  const ctx = await request.newContext({
    baseURL: base,
    storageState: 'playwright/.auth/user.json',
    ignoreHTTPSErrors: true,
    extraHTTPHeaders: { Accept: '*/*' },
    timeout: 60_000,
  });

  try {
    const res = await ctx.post('DocumentLoad.jsp', {
      form: {
        documentNumber: positionId,
        documentID: '15630',
        StateID: '1',
        loadXML: FK_LOAD_XML,
        doLoad: '1',
      },
    });

    const text = await res.text();
    const tableMatches = [...text.matchAll(/var\s+([A-Z0-9_]+)\s*=\s*new\s+RSObject\(/g)];
    const tables = tableMatches.map((m) => m[1]);
    console.log(`TABLES: ${tables.join(', ')}`);

    const rowMatches = [...text.matchAll(/([A-Z0-9_]+)\.SetByList\("([\s\S]*?)",\s*"~;~"\)/g)];
    for (const match of rowMatches) {
      const table = match[1];
      const rowText = match[2];
      if (rowText.includes('2097') || rowText.includes('4051')) {
        console.log(`\nMATCH_TABLE: ${table}`);
        console.log(`ROW_SAMPLE: ${rowText.slice(0, 700)}`);
      }
    }
  } finally {
    await ctx.dispose();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
