const fs = require('fs');

const doc = fs.readFileSync('test-results/cas-docload-num-55396.js.txt', 'utf8');
const listMatch = doc.match(/PSM_APP_SETTING_COMPANY\.SetFieldNameByList\("([\s\S]*?)"\s*,\s*"~;~"\)/);
if (!listMatch) {
  console.error('SetFieldNameByList not found');
  process.exit(1);
}
const cols = listMatch[1].split('~;~').filter((c, i, a) => !(i === a.length - 1 && c === ''));
console.log('col names', cols.length);
const targets = [
  'SUBSCRIBER_ID',
  'COMPANY_ID',
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
for (const t of targets) console.log(t, cols.indexOf(t));

const rowMatch = doc.match(/PSM_APP_SETTING_COMPANY\.SetByList\("([\s\S]*?)",\s*"~;~"\)/);
const cells = rowMatch[1].split('~;~');
for (const t of targets) {
  const i = cols.indexOf(t);
  console.log(`value ${t} @${i} =`, JSON.stringify(cells[i]));
}

fs.writeFileSync(
  'test-results/cas-colnames-15249.json',
  JSON.stringify(
    {
      documentId: 15249,
      table: 'PSM_APP_SETTING_COMPANY',
      indexes: Object.fromEntries(targets.map((t) => [t, cols.indexOf(t)])),
      colnames: cols,
    },
    null,
    2
  )
);
console.log('saved test-results/cas-colnames-15249.json');
