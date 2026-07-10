const fs = require('fs');
const path = require('path');

const screen = fs.readFileSync(path.resolve('test-results/cas-screen-10292.html'), 'utf8');
const doc = fs.readFileSync(path.resolve('test-results/cas-docload-15249.js.txt'), 'utf8');

const targetFields = [
  'TAX_LEVEL_1_AUTHORITY_ID',
  'TAX_LEVEL_2_AUTHORITY_ID',
  'TAX_LEVEL_3_AUTHORITY_ID',
  'TAX_LEVEL_4_AUTHORITY_ID',
  'SHOW_TAX_LEVEL_FIELDS',
  'TAX_AUTH_DEPT',
  'OVERRIDE_TAX_GL_FLAG',
  'TAX_LEVELS',
  'TAX_TYPE',
  'USE_TAX',
  'GL_VALIDATION',
  'DEPT',
];

console.log('=== FieldObject entries ===');
const fieldRe = /FIELD\[(\d+)\]\s*=\s*new FieldObject\(([^)]*)\)/g;
let m;
const fields = [];
while ((m = fieldRe.exec(screen)) !== null) {
  const args = m[2];
  if (!/PSM_APP_SETTING_COMPANY/.test(args)) continue;
  const nameMatch = args.match(/"([A-Z0-9_]+)"\s*,\s*"[^"]*"\s*,\s*"/);
  // FieldObject("0","len?","type?","TABLE","H1","","COLUMN_NAME","label"...
  const parts = [...args.matchAll(/"([^"]*)"/g)].map((x) => x[1]);
  // typical: 0, size/len, type, table, section, ?, column, label
  const column = parts[6];
  const label = parts[7];
  if (!column) continue;
  if (/TAX|DEPT|GL_VALID|AUTHORITY|OVERRIDE/i.test(column + ' ' + (label || ''))) {
    fields.push({ index: m[1], column, label, parts: parts.slice(0, 10) });
  }
}
for (const f of fields) {
  console.log(`FIELD[${f.index}] col=${f.column} label=${f.label} parts=${JSON.stringify(f.parts)}`);
}

console.log('\n=== USE/GL validation candidates ===');
for (const re of [/USE_TAX[A-Z0-9_]*/gi, /GL_VALID[A-Z0-9_]*/gi, /TAX_DEPT[A-Z0-9_]*/gi, /TAX_TYPE[A-Z0-9_]*/gi]) {
  console.log(re, [...screen.matchAll(re)].map((x) => x[0]).filter((v, i, a) => a.indexOf(v) === i).slice(0, 20));
}

console.log('\n=== DocumentLoad row ===');
const rs = doc.match(/var\s+PSM_APP_SETTING_COMPANY\s*=\s*new\s+RSObject\((\d+),/);
console.log('colCount', rs && rs[1]);
const rowMatch = doc.match(/PSM_APP_SETTING_COMPANY\.SetByList\("([\s\S]*?)",\s*"~;~"\)/);
if (rowMatch) {
  const cells = rowMatch[1].split('~;~');
  console.log('cells', cells.length);
  const nonEmpty = cells
    .map((c, i) => ({ i, c }))
    .filter((x) => x.c && String(x.c).trim() !== '');
  console.log('nonEmpty count', nonEmpty.length);
  console.log(nonEmpty.slice(0, 100));
}

// Try to find column order array in screen HTML
console.log('\n=== possible colnames arrays ===');
const colArrays = [...screen.matchAll(/PSM_APP_SETTING_COMPANY[^;]{0,200}?(TAX_LEVEL_1_AUTHORITY_ID|SHOW_TAX_LEVEL_FIELDS|TAX_AUTH_DEPT)[^;]{0,200}/gi)];
for (const x of colArrays.slice(0, 10)) console.log(x[0].replace(/\s+/g, ' ').slice(0, 300));

// Search for ordered column list near RSObject init in screen
const init = screen.match(/PSM_APP_SETTING_COMPANY\s*=\s*new\s+RSObject\([\s\S]{0,500}/);
console.log('\nRSObject init snippet', init && init[0].replace(/\s+/g, ' ').slice(0, 500));
