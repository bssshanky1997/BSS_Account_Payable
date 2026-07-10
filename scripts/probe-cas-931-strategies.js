const path = require('path');
const dotenv = require('dotenv');
const { request } = require('@playwright/test');

dotenv.config({ path: path.resolve(__dirname, '..', '.env'), override: true });

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
    baseURL: new URL('/j4/', process.env.BASE_URL || 'https://appqa.birchstreet.co').toString(),
    storageState: path.resolve(__dirname, '..', 'playwright/.auth/user.json'),
    ignoreHTTPSErrors: true,
    timeout: 60_000,
  });

  try {
    const DOC_ID = '15249';
    const DOC_NUM = '931';
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
    const tableDefs = [...text.matchAll(/var\s+([A-Z0-9_]+)\s*=\s*new\s+RSObject\((\d+),/g)].map((m) => ({
      tableName: m[1],
      colCount: Number(m[2]),
    }));
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

    console.log(
      'tables',
      tables.map((t) => `${t.tableName}:${t.rows.length}`).join(', ')
    );

    const main = tables.find((t) => t.tableName === 'PSM_APP_SETTING_COMPANY');
    const baseRow = [...main.rows[0]];
    const taxTypeIdx = main.columnNames.indexOf('TAX_TYPE');
    const showIdx = main.columnNames.indexOf('SHOW_TAX_LEVEL_FIELDS');
    console.log('TAX_TYPE', baseRow[taxTypeIdx], 'SHOW', baseRow[showIdx]);

    const strategies = [
      {
        name: 'A tax=1 show=4 preserve-all Nothing',
        patch: (row) => {
          row[taxTypeIdx] = '1';
          row[showIdx] = '4';
        },
        emptyHist: false,
        docNum: 'Nothing',
      },
      {
        name: 'B tax=1 show=4 preserve-all doc=931',
        patch: (row) => {
          row[taxTypeIdx] = '1';
          row[showIdx] = '4';
        },
        emptyHist: false,
        docNum: '931',
      },
      {
        name: 'C tax=1 only preserve-all Nothing',
        patch: (row) => {
          row[taxTypeIdx] = '1';
        },
        emptyHist: false,
        docNum: 'Nothing',
      },
      {
        name: 'D tax=1 show=4 empty-hist Nothing',
        patch: (row) => {
          row[taxTypeIdx] = '1';
          row[showIdx] = '4';
        },
        emptyHist: true,
        docNum: 'Nothing',
      },
      {
        name: 'E no-change preserve-all Nothing (baseline)',
        patch: () => {},
        emptyHist: false,
        docNum: 'Nothing',
      },
    ];

    for (const strategy of strategies) {
      const row = [...baseRow];
      strategy.patch(row);
      const tableXml = tables
        .map((table) => {
          if (table.tableName === main.tableName) return buildTableXml(table.tableName, table.colCount, [row]);
          if (strategy.emptyHist && /CHG_HIST$/i.test(table.tableName)) {
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

      const html = await (await ctx.get('agscreen.jsp?screenid=10292')).text();
      const csrf = (html.match(/csrf_xyz123=([a-f0-9]{20,})/i) || [])[1];
      const save = await ctx.post('DocumentSave.jsp', {
        form: {
          doctype: DOC_ID,
          xml,
          state: '1',
          action: 'U',
          documentNumber: strategy.docNum,
          csrf_xyz123: csrf,
          rowInEditing: '',
          columnInEditing: '',
          xmlCompressed: '0',
          xmlOriginalSize: '',
        },
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
      const st = await save.text();
      const ok = save.ok() && /saveStatus\s*=\s*"true"/i.test(st) && !/Internal Server Error/i.test(st);
      const statusMatch = st.match(/saveStatus\s*=\s*"([^"]*)"/i);
      console.log(strategy.name, '=>', ok ? 'OK' : 'FAIL', 'saveStatus=', statusMatch && statusMatch[1]);
      if (ok) break;
    }
  } finally {
    await ctx.dispose();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
