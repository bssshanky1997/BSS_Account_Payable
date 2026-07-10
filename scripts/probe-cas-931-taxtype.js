const path = require('path');
const dotenv = require('dotenv');
const { request } = require('@playwright/test');

dotenv.config({ path: path.resolve(__dirname, '..', '.env'), override: true });

const BASE_URL = String(process.env.BASE_URL || 'https://appqa.birchstreet.co').trim();
const DOC_ID = '15249';
const DOC_NUM = String(process.env.TARGET_COMPANY_ID || '931');

const xmlEscape = (v) =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const parseDelimited = (value) =>
  value
    .replace(/\\\\/g, '\\')
    .replace(/\\"/g, '"')
    .split('~;~')
    .filter((part, index, arr) => !(index === arr.length - 1 && part === ''));

function buildTableXml(tableName, colCount, rows) {
  const rowXml = rows
    .map((row) => {
      const cells = Array.from({ length: colCount }, (_, i) => `<c>${xmlEscape(row[i] ?? '')}</c>`).join('');
      return `<ROW>${cells}</ROW>`;
    })
    .join('');
  return `<TABLE><${tableName}><COLCOUNT>${colCount}</COLCOUNT><ROWCOUNT>${rows.length}</ROWCOUNT>${rowXml}</${tableName}></TABLE>`;
}

async function main() {
  const ctx = await request.newContext({
    baseURL: new URL('/j4/', BASE_URL).toString(),
    storageState: path.resolve(__dirname, '..', 'playwright/.auth/user.json'),
    ignoreHTTPSErrors: true,
    timeout: 60_000,
  });

  try {
    const load = await ctx.post('DocumentLoad.jsp', {
      form: {
        documentNumber: DOC_NUM,
        documentID: DOC_ID,
        StateID: '1',
        loadXML: '<FOREIGN_KEY_DESC></FOREIGN_KEY_DESC>',
        doLoad: '1',
      },
    });
    const text = await load.text();
    console.log('LOAD', load.status(), 'len', text.length, 'has SetByList', /SetByList/i.test(text));

    const tableDefs = [...text.matchAll(/var\s+([A-Z0-9_]+)\s*=\s*new\s+RSObject\((\d+),/g)].map((m) => ({
      tableName: m[1],
      colCount: Number(m[2]),
    }));
    console.log(
      'tables',
      tableDefs.map((t) => t.tableName + ':' + t.colCount).join(', ')
    );

    const tables = tableDefs.map(({ tableName, colCount }) => {
      const namesMatch = text.match(
        new RegExp(`${tableName}\\.SetFieldNameByList\\("([\\s\\S]*?)"\\s*,\\s*"~;~"\\)`)
      );
      const columnNames = namesMatch ? parseDelimited(namesMatch[1]) : [];
      const rows = [];
      const rowRe = new RegExp(`${tableName}\\.SetByList\\("([\\s\\S]*?)",\\s*"~;~"\\)`, 'g');
      let match;
      while ((match = rowRe.exec(text)) !== null) {
        const row = parseDelimited(match[1]);
        while (row.length < colCount) row.push('');
        rows.push(row.slice(0, colCount));
      }
      return { tableName, colCount, columnNames, rows };
    });

    const main = tables.find((t) => t.tableName === 'PSM_APP_SETTING_COMPANY');
    if (!main || !main.rows[0]) throw new Error('no main row');
    const row = [...main.rows[0]];
    const companyIdx = main.columnNames.indexOf('COMPANY_ID');
    const taxTypeIdx = main.columnNames.indexOf('TAX_TYPE');
    const showIdx = main.columnNames.indexOf('SHOW_TAX_LEVEL_FIELDS');
    console.log('COMPANY_ID', companyIdx >= 0 ? row[companyIdx] : 'missing');
    console.log('TAX_TYPE before', taxTypeIdx, taxTypeIdx >= 0 ? row[taxTypeIdx] : '');
    console.log('SHOW before', showIdx, showIdx >= 0 ? row[showIdx] : '');

    if (taxTypeIdx >= 0) row[taxTypeIdx] = '1';
    if (showIdx >= 0) row[showIdx] = '4';

    const tableXml = tables
      .map((table) => {
        if (table.tableName === main.tableName) return buildTableXml(table.tableName, table.colCount, [row]);
        if (/CHG_HIST$/i.test(table.tableName)) return buildTableXml(table.tableName, table.colCount, []);
        return buildTableXml(table.tableName, table.colCount, table.rows);
      })
      .join('');

    const xml =
      `<DOC_ROOT><DOC_COUNT>1</DOC_COUNT><NEW_DOC><DOCUMENT>` +
      `<DOCMETA><NAME>Company Application Setting</NAME><DOCUMENT_ID>${DOC_ID}</DOCUMENT_ID>` +
      `<DOCUMENT_STATE>1</DOCUMENT_STATE><FULLXMLDOC>true</FULLXMLDOC><TABLECOUNT>${tables.length}</TABLECOUNT></DOCMETA>` +
      tableXml +
      `<PBUTTON></PBUTTON></DOCUMENT></NEW_DOC></DOC_ROOT>`;

    const html = await (await ctx.get('agscreen.jsp?screenid=10292')).text();
    const csrf = (html.match(/csrf_xyz123=([a-f0-9]{20,})/i) || [])[1];
    if (!csrf) throw new Error('csrf missing');

    const save = await ctx.post('DocumentSave.jsp', {
      form: {
        doctype: DOC_ID,
        xml,
        state: '1',
        action: 'U',
        documentNumber: 'Nothing',
        csrf_xyz123: csrf,
        rowInEditing: '',
        columnInEditing: '',
        xmlCompressed: '0',
        xmlOriginalSize: '',
      },
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    const saveText = await save.text();
    console.log('SAVE status', save.status());
    console.log('has Internal Server Error', /Internal Server Error/i.test(saveText));
    console.log('has saveStatus false', /saveStatus\s*=\s*"false"/i.test(saveText));
    console.log('has Unhandled error', /Unhandled error/i.test(saveText));
    const saveStatus = saveText.match(/saveStatus\s*=\s*"([^"]*)"/i);
    console.log('saveStatus match', saveStatus && saveStatus[1]);
    console.log('snippet', saveText.replace(/\s+/g, ' ').slice(0, 800));

    // reload verify
    const load2 = await ctx.post('DocumentLoad.jsp', {
      form: {
        documentNumber: DOC_NUM,
        documentID: DOC_ID,
        StateID: '1',
        loadXML: '<FOREIGN_KEY_DESC></FOREIGN_KEY_DESC>',
        doLoad: '1',
      },
    });
    const text2 = await load2.text();
    const names = parseDelimited(
      text2.match(/PSM_APP_SETTING_COMPANY\.SetFieldNameByList\("([\s\S]*?)"\s*,\s*"~;~"\)/)[1]
    );
    const row2 = parseDelimited(text2.match(/PSM_APP_SETTING_COMPANY\.SetByList\("([\s\S]*?)",\s*"~;~"\)/)[1]);
    console.log('TAX_TYPE after', row2[names.indexOf('TAX_TYPE')]);
    console.log('SHOW after', row2[names.indexOf('SHOW_TAX_LEVEL_FIELDS')]);
  } finally {
    await ctx.dispose();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
