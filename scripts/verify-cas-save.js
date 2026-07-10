/**
 * Smoke-verify CAS Tax Authority Level DocumentLoad → patch → DocumentSave.
 * Usage:
 *   $env:CAS_COMPANY_DOCUMENT_NUMBER='55396'; $env:DOC_ID_COMPANY_APPLICATION_SETTING='15249'; node scripts/verify-cas-save.js
 */
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const { chromium, request } = require('@playwright/test');

dotenv.config({ path: path.resolve(__dirname, '..', '.env'), override: true });

const BASE_URL = String(process.env.BASE_URL || 'https://appqa.birchstreet.co').trim();
const AUTH_PATH = path.resolve(__dirname, '..', 'playwright/.auth/user.json');
const DOC_ID = String(process.env.DOC_ID_COMPANY_APPLICATION_SETTING || '15249');
const DOC_NUM = String(process.env.CAS_COMPANY_DOCUMENT_NUMBER || '55396');
const SCREEN_ID = '10292';

const xmlEscape = (value) =>
  String(value ?? '')
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

async function ensureAuth() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();
  try {
    await page.goto(new URL('/j4/login.jsp', BASE_URL).toString(), {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    });
    await page.locator('#loginID').fill(process.env.USERNAME);
    await page.locator('#password').fill(process.env.PASSWORD);
    await page.locator('#subscriberID').fill(process.env.SUBSCRIBER_ID);
    const btn = page.locator('#submitLogin').first();
    if (await btn.isVisible().catch(() => false)) await btn.click({ noWaitAfter: true });
    else await page.getByRole('button', { name: 'Login' }).click({ noWaitAfter: true });
    const deadline = Date.now() + 60_000;
    while (Date.now() < deadline) {
      if (!page.url().includes('/j4/login.jsp') && (await page.locator('#compDiv').isVisible().catch(() => false))) {
        break;
      }
      await page.waitForTimeout(400);
    }
    fs.mkdirSync(path.dirname(AUTH_PATH), { recursive: true });
    await context.storageState({ path: AUTH_PATH });
    console.log('auth refreshed', page.url());
  } finally {
    await browser.close();
  }
}

function buildTableXml(tableName, colCount, rows) {
  const rowXml = rows
    .map((row) => {
      const cells = Array.from({ length: colCount }, (_, i) => `<c>${xmlEscape(row[i] ?? '')}</c>`).join('');
      return `<ROW>${cells}</ROW>`;
    })
    .join('');
  return `<TABLE><${tableName}><COLCOUNT>${colCount}</COLCOUNT><ROWCOUNT>${rows.length}</ROWCOUNT>${rowXml}</${tableName}></TABLE>`;
}

function parseTables(text) {
  const tableDefs = [...text.matchAll(/var\s+([A-Z0-9_]+)\s*=\s*new\s+RSObject\((\d+),/g)].map((m) => ({
    tableName: m[1],
    colCount: Number(m[2]),
  }));

  return tableDefs.map(({ tableName, colCount }) => {
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
}

async function main() {
  await ensureAuth();

  const ctx = await request.newContext({
    baseURL: new URL('/j4/', BASE_URL).toString(),
    storageState: AUTH_PATH,
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
    console.log('LOAD status', load.status(), 'len', text.length);

    const tables = parseTables(text);
    console.log(
      'tables',
      tables.map((t) => `${t.tableName} cols=${t.colCount} rows=${t.rows.length}`).join(' | ')
    );

    const main = tables.find((t) => t.tableName === 'PSM_APP_SETTING_COMPANY') || tables[0];
    if (!main || !main.rows[0]) throw new Error('No CAS main row loaded');

    const names = main.columnNames;
    const row = [...main.rows[0]];
    const taxTypeIdx = names.indexOf('TAX_TYPE');
    const showIdx = names.indexOf('SHOW_TAX_LEVEL_FIELDS');
    console.log('COMPANY_ID', names.indexOf('COMPANY_ID') >= 0 ? row[names.indexOf('COMPANY_ID')] : '(missing)');
    console.log('TAX_TYPE', taxTypeIdx, taxTypeIdx >= 0 ? row[taxTypeIdx] : '');
    console.log('SHOW_TAX_LEVEL_FIELDS', showIdx, showIdx >= 0 ? row[showIdx] : '');

    if (taxTypeIdx >= 0) row[taxTypeIdx] = '1';
    if (showIdx >= 0) row[showIdx] = '4';

    // Safe path used by API_Helper: all tables, preserve child rows, empty history only.
    const tableXml = tables
      .map((table) => {
        if (table.tableName === main.tableName) {
          return buildTableXml(table.tableName, table.colCount, [row]);
        }
        if (/CHG_HIST$/i.test(table.tableName)) {
          return buildTableXml(table.tableName, table.colCount, []);
        }
        return buildTableXml(table.tableName, table.colCount, table.rows);
      })
      .join('');

    const xml =
      `<DOC_ROOT><DOC_COUNT>1</DOC_COUNT><NEW_DOC><DOCUMENT>` +
      `<DOCMETA><NAME>Company Application Setting</NAME><DOCUMENT_ID>${DOC_ID}</DOCUMENT_ID>` +
      `<DOCUMENT_STATE>1</DOCUMENT_STATE><FULLXMLDOC>true</FULLXMLDOC><TABLECOUNT>${tables.length}</TABLECOUNT></DOCMETA>` +
      tableXml +
      `<PBUTTON></PBUTTON></DOCUMENT></NEW_DOC></DOC_ROOT>`;

    const screen = await ctx.get(`agscreen.jsp?screenid=${SCREEN_ID}`);
    const html = await screen.text();
    const csrf = (html.match(/csrf_xyz123=([a-f0-9]{20,})/i) || [])[1];
    if (!csrf) throw new Error('csrf missing from CAS screen');

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
    const ok =
      save.ok() && !/Internal Server Error|saveStatus\s*=\s*"false"|Unhandled error/i.test(saveText);
    console.log('SAVE status', save.status(), 'ok?', ok);
    console.log(saveText.replace(/\s+/g, ' ').slice(0, 400));
    if (!ok) process.exitCode = 1;
  } finally {
    await ctx.dispose();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
