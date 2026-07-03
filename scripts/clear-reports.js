const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');

const dirsToClear = [
  'reports/report',
  'reports/result',
  'reports/screenshot',
  'reports/failed-screenshot',
  'logs'
];

const legacyPathsToRemove = [
  'reports/html-report',
  'reports/allure-results',
  'reports/allure-report',
  'reports/json-report',
  'reports/excel-report',
  'reports/excel-results',
  'reports/test-results',
  'reports-archive',
  'excel-archive',
  'screenshots',
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

for (const legacyRelativePath of legacyPathsToRemove) {
  const legacyAbsolutePath = path.join(projectRoot, legacyRelativePath);
  if (!fs.existsSync(legacyAbsolutePath)) continue;
  fs.rmSync(legacyAbsolutePath, { recursive: true, force: true });
  console.log(`Removed legacy path: ${legacyAbsolutePath}`);
}

console.log('Unified report folders were reset successfully.');
