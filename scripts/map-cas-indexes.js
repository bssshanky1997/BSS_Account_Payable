const fs = require('fs');

const screen = fs.readFileSync('test-results/cas-screen-10292.html', 'utf8');
const doc = fs.readFileSync('test-results/cas-docload-15249.js.txt', 'utf8');

// Extract all PSM_APP_SETTING_COMPANY FieldObject column names in FIELD[n] numeric order
const fields = [];
const re = /FIELD\[(\d+)\]\s*=\s*new FieldObject\(([\s\S]*?)\);/g;
let m;
while ((m = re.exec(screen)) !== null) {
  const idx = Number(m[1]);
  const args = m[2];
  const parts = [...args.matchAll(/"([^"]*)"/g)].map((x) => x[1]);
  if (parts[3] !== 'PSM_APP_SETTING_COMPANY') continue;
  const column = parts[6];
  if (!column) continue;
  fields.push({ fieldIndex: idx, column });
}
fields.sort((a, b) => a.fieldIndex - b.fieldIndex);
console.log('field count', fields.length);
console.log('first 20', fields.slice(0, 20));

const targets = [
  'TAX_TYPE',
  'TAX_LEVEL_1_AUTHORITY_ID',
  'TAX_LEVEL_2_AUTHORITY_ID',
  'TAX_LEVEL_3_AUTHORITY_ID',
  'TAX_LEVEL_4_AUTHORITY_ID',
  'TAX_AUTH_DEPT',
  'USE_TAX_AUTH_DEPT_FOR_GL_CHECK',
  'SHOW_TAX_LEVEL_FIELDS',
  'OVERRIDE_TAX_GL_FLAG',
];

// Hypothesis 1: FIELD index == row cell index
console.log('\nHypothesis FIELD index == cell index');
for (const t of targets) {
  const f = fields.find((x) => x.column === t);
  console.log(t, f);
}

// Hypothesis 2: ordered unique columns by FIELD index map to 0..n
const ordered = [];
const seen = new Set();
for (const f of fields) {
  if (seen.has(f.column)) continue;
  seen.add(f.column);
  ordered.push(f.column);
}
console.log('\nunique ordered columns', ordered.length);
for (const t of targets) {
  console.log(t, 'ordIdx', ordered.indexOf(t));
}

// Check DocumentLoad for column name list near table
const nameHits = [...doc.matchAll(/TAX_LEVEL_1_AUTHORITY_ID|SHOW_TAX_LEVEL_FIELDS|TAX_AUTH_DEPT|USE_TAX_AUTH_DEPT_FOR_GL_CHECK/g)];
console.log('\ndoc name hits', nameHits.length);

// Look in screen for an array assigning colnames for PSM_APP_SETTING_COMPANY
const arr = screen.match(/PSM_APP_SETTING_COMPANY[\s\S]{0,200}?colnames[\s\S]{0,500}/i);
console.log('\ncolnames near table', arr && arr[0].slice(0, 400));

// Search for SUBSCRIBER_ID / COMPANY_ID field indexes - row[0]=641 subscriber
const sub = fields.find((x) => x.column === 'SUBSCRIBER_ID');
const company = fields.find((x) => x.column === 'COMPANY_ID');
console.log('SUBSCRIBER_ID field', sub);
console.log('COMPANY_ID field', company);

// Print fields around tax section
console.log('\nfields 190-240');
for (const f of fields.filter((x) => x.fieldIndex >= 190 && x.fieldIndex <= 240)) {
  console.log(f.fieldIndex, f.column);
}

// Maybe row uses physical DB column order from CREATE or from a meta list in HTML comments
const meta = screen.match(/columnList\s*=\s*\[([\s\S]*?)\]/i);
console.log('columnList', meta && meta[0].slice(0, 300));

// Look for "~;~" joined colnames in screen
const joined = [...screen.matchAll(/([A-Z0-9_]{3,}(?:~;~[A-Z0-9_]{3,}){20,})/g)].map((x) => x[1]);
console.log('joined colnames candidates', joined.length);
for (const j of joined.slice(0, 3)) {
  const cols = j.split('~;~');
  console.log('len', cols.length, 'has SHOW_TAX', cols.includes('SHOW_TAX_LEVEL_FIELDS'), 'idx', cols.indexOf('SHOW_TAX_LEVEL_FIELDS'));
  if (cols.includes('SHOW_TAX_LEVEL_FIELDS')) {
    for (const t of targets) console.log(' ', t, cols.indexOf(t));
    console.log('sample around tax', cols.slice(Math.max(0, cols.indexOf('TAX_TYPE') - 2), cols.indexOf('TAX_TYPE') + 15));
  }
}
