const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');

const dirsToClear = [
  'reports/html-report',
  'reports/allure-results',
  'reports/allure-report',
  'reports/json-report',
  'reports/excel-report',
  'reports-archive',
  'excel-archive',
  'logs',
  'test-results'
];

function clearDirectory(absPath) {
  if (!fs.existsSync(absPath)) {
    fs.mkdirSync(absPath, { recursive: true });
    return;
  }

  for (const entry of fs.readdirSync(absPath)) {
    const fullEntryPath = path.join(absPath, entry);
    fs.rmSync(fullEntryPath, { recursive: true, force: true });
  }
}

for (const relativeDir of dirsToClear) {
  const absoluteDir = path.join(projectRoot, relativeDir);
  clearDirectory(absoluteDir);
  console.log(`Cleared: ${absoluteDir}`);
}

console.log('All report/log folders were cleared successfully.');
