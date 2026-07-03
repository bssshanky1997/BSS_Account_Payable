const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');

const args = process.argv.slice(2);

function getArg(flag, defaultValue = '') {
  const index = args.indexOf(flag);
  if (index === -1 || index === args.length - 1) return defaultValue;
  return args[index + 1];
}

function ensureDirectory(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function toIso(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

function formatSeconds(ms) {
  return Math.round((Number(ms || 0) / 1000) * 100) / 100;
}

function safeReadJson(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function normalizeCellValue(value) {
  if (value === null || value === undefined) return '';
  if (value instanceof Set) return Array.from(value).join(', ');
  if (Array.isArray(value)) return value.join(', ');
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    }
    catch (_error) {
      return String(value);
    }
  }
  return value;
}

function getHeadersFromRows(rows) {
  const headers = [];
  const seen = new Set();
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    for (const key of Object.keys(row)) {
      if (seen.has(key)) continue;
      seen.add(key);
      headers.push(key);
    }
  }
  return headers;
}

function addWorksheetFromJson(workbook, sheetName, rows) {
  const worksheet = workbook.addWorksheet(sheetName);
  const safeRows = Array.isArray(rows) && rows.length ? rows : [{}];
  const headers = getHeadersFromRows(safeRows);

  if (!headers.length) {
    worksheet.addRow(['']);
    return worksheet;
  }

  worksheet.columns = headers.map((header) => ({ header, key: header }));

  for (const row of safeRows) {
    const normalizedRow = {};
    for (const header of headers) {
      normalizedRow[header] = normalizeCellValue(row && Object.prototype.hasOwnProperty.call(row, header) ? row[header] : '');
    }
    worksheet.addRow(normalizedRow);
  }

  return worksheet;
}

function normalizeWorksheetCellValue(value) {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    if (Object.prototype.hasOwnProperty.call(value, 'result')) return value.result;
    if (Object.prototype.hasOwnProperty.call(value, 'text')) return value.text;
    if (Array.isArray(value.richText)) {
      return value.richText.map((part) => part.text || '').join('');
    }
    try {
      return JSON.stringify(value);
    }
    catch (_error) {
      return String(value);
    }
  }
  return value;
}

function worksheetToJson(worksheet) {
  if (!worksheet || worksheet.rowCount < 1) return [];
  const headerRow = worksheet.getRow(1);
  const headers = [];

  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    const headerValue = String(normalizeWorksheetCellValue(cell.value) || '').trim();
    if (headerValue) headers[colNumber] = headerValue;
  });

  if (!headers.length) return [];

  const rows = [];
  for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    if (!row.hasValues) continue;

    const rowData = {};
    let hasAtLeastOneValue = false;

    for (let colNumber = 1; colNumber < headers.length; colNumber += 1) {
      const header = headers[colNumber];
      if (!header) continue;
      const value = normalizeWorksheetCellValue(row.getCell(colNumber).value);
      rowData[header] = value;
      if (value !== '') hasAtLeastOneValue = true;
    }

    if (hasAtLeastOneValue) rows.push(rowData);
  }

  return rows;
}

function collectTests(suites, records, parentSuite = '') {
  if (!Array.isArray(suites)) return;

  for (const suite of suites) {
    const suiteTitle = [parentSuite, suite.title || ''].filter(Boolean).join(' > ');
    const specs = Array.isArray(suite.specs) ? suite.specs : [];

    for (const spec of specs) {
      const tests = Array.isArray(spec.tests) ? spec.tests : [];

      for (const test of tests) {
        const results = Array.isArray(test.results) ? test.results : [];
        const latestResult = results.length ? results[results.length - 1] : null;
        const errorMessage = latestResult && latestResult.error && latestResult.error.message
          ? latestResult.error.message
          : '';

        records.push({
          file: spec.file || '',
          suite: suiteTitle,
          testTitle: spec.title || '',
          project: test.projectName || '',
          outcome: test.outcome || '',
          status: latestResult ? (latestResult.status || '') : '',
          retry: latestResult ? Number(latestResult.retry || 0) : 0,
          durationSeconds: latestResult ? formatSeconds(latestResult.duration) : 0,
          error: errorMessage
        });
      }
    }

    collectTests(suite.suites, records, suiteTitle);
  }
}

function walkFiles(dirPath, collector) {
  if (!fs.existsSync(dirPath)) return;

  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      walkFiles(fullPath, collector);
      continue;
    }
    collector(fullPath);
  }
}

function isPotentialTestFile(filePath) {
  const normalized = filePath.replace(/\\/g, '/');
  if (!normalized.endsWith('.ts') && !normalized.endsWith('.js')) return false;
  if (normalized.endsWith('.d.ts')) return false;
  return normalized.includes('/tests/') || normalized.includes('/Test_Classes/');
}

function extractTestTitlesFromSource(fileContent) {
  const titles = [];
  const regex = /\btest(?:\.(?:only|skip|fixme|fail|slow))?\s*\(\s*(['"`])((?:\\.|(?!\1)[\s\S])*?)\1/g;
  let match;

  while ((match = regex.exec(fileContent)) !== null) {
    const title = (match[2] || '').trim();
    if (!title || title.includes('${')) continue;
    titles.push(title);
  }

  return titles;
}

function collectDiscoveredTests(projectRootPath) {
  const discoveredRows = [];
  const seen = new Set();
  const targetDirs = [
    path.join(projectRootPath, 'tests'),
    path.join(projectRootPath, 'Test_Classes')
  ];

  for (const targetDir of targetDirs) {
    walkFiles(targetDir, (filePath) => {
      if (!isPotentialTestFile(filePath)) return;

      const content = fs.readFileSync(filePath, 'utf8');
      const titles = extractTestTitlesFromSource(content);
      const normalizedFile = path.relative(projectRootPath, filePath).replace(/\\/g, '/');

      for (const title of titles) {
        const key = `${normalizedFile}::${title}`;
        if (seen.has(key)) continue;
        seen.add(key);

        discoveredRows.push({
          file: normalizedFile,
          suite: '',
          testTitle: title,
          project: '',
          outcome: 'notRun',
          status: 'notRun',
          retry: 0,
          durationSeconds: 0,
          error: 'Not executed (run aborted before this test could start).'
        });
      }
    });
  }

  return discoveredRows;
}

function mergeMissingDiscoveredTests(executedRows, discoveredRows, globalErrorMessage = '') {
  const mergedRows = [...executedRows];
  const existingKeys = new Set(
    executedRows.map((row) => `${row.file || ''}::${row.testTitle || ''}`)
  );

  for (const discovered of discoveredRows) {
    const key = `${discovered.file || ''}::${discovered.testTitle || ''}`;
    if (existingKeys.has(key)) continue;

    if (globalErrorMessage) {
      discovered.error = globalErrorMessage;
    }

    mergedRows.push(discovered);
  }

  return mergedRows;
}

function buildFailureSummaryRows(testRows) {
  const grouped = new Map();

  for (const row of testRows) {
    const isFailed = row.outcome === 'unexpected' || row.status === 'failed' || row.status === 'timedOut';
    if (!isFailed) continue;

    const key = `${row.file}__${row.suite}`;
    const current = grouped.get(key) || {
      file: row.file,
      suite: row.suite,
      failedTests: 0,
      uniqueFailingTests: new Set(),
      sampleError: ''
    };

    current.failedTests += 1;
    current.uniqueFailingTests.add(row.testTitle);
    if (!current.sampleError && row.error) {
      current.sampleError = row.error;
    }

    grouped.set(key, current);
  }

  return Array.from(grouped.values())
    .map((item) => ({
      file: item.file,
      suite: item.suite,
      failedTests: item.failedTests,
      uniqueFailingTests: item.uniqueFailingTests.size,
      sampleError: item.sampleError
    }))
    .sort((a, b) => b.failedTests - a.failedTests);
}

function normalizeSummaryRow(row, sourceFile = 'current') {
  const totalTests = Number(row.totalTests || 0);
  const failed = Number(row.failed || 0);

  return {
    sourceFile,
    taskName: row.taskName || '',
    runStartTime: row.runStartTime || '',
    runEndTime: row.runEndTime || '',
    totalDurationMinutes: Number(row.totalDurationMinutes || 0),
    runResult: row.runResult || '',
    exitCode: Number(row.exitCode || 0),
    totalTests,
    passed: Number(row.passed || 0),
    failed,
    passRate: totalTests > 0 ? Math.round(((totalTests - failed) / totalTests) * 10000) / 100 : 0,
    failureRate: totalTests > 0 ? Math.round((failed / totalTests) * 10000) / 100 : 0,
    flaky: Number(row.flaky || 0),
    skipped: Number(row.skipped || 0)
  };
}

async function buildFailureTrendRows(trendDir, currentSummary, maxRows = 30) {
  const trendRows = [];

  if (fs.existsSync(trendDir)) {
    const files = fs.readdirSync(trendDir)
      .filter((name) => name.toLowerCase().endsWith('.xlsx'))
      .map((name) => path.join(trendDir, name));

    for (const filePath of files) {
      try {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(filePath);
        const runSummarySheet = workbook.getWorksheet('RunSummary');
        if (!runSummarySheet) continue;

        const rows = worksheetToJson(runSummarySheet);
        if (!rows.length) continue;

        trendRows.push(normalizeSummaryRow(rows[0], path.basename(filePath)));
      }
      catch (error) {
        // Ignore unreadable/partial files and continue trend generation.
      }
    }
  }

  trendRows.push(normalizeSummaryRow(currentSummary, 'current-run'));

  const uniqueRows = [];
  const seen = new Set();
  for (const row of trendRows) {
    const key = `${row.taskName}|${row.runStartTime}|${row.runEndTime}|${row.totalTests}|${row.failed}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueRows.push(row);
    }
  }

  return uniqueRows
    .sort((a, b) => {
      const aTime = Date.parse(a.runStartTime || '');
      const bTime = Date.parse(b.runStartTime || '');
      if (Number.isNaN(aTime) && Number.isNaN(bTime)) return 0;
      if (Number.isNaN(aTime)) return 1;
      if (Number.isNaN(bTime)) return -1;
      return bTime - aTime;
    })
    .slice(0, maxRows);
}

async function buildWorkbook(summaryRow, testRows) {
  const workbook = new ExcelJS.Workbook();

  const failureRows = buildFailureSummaryRows(testRows);
  const failureSheetData = failureRows.length
    ? failureRows
    : [{ file: '', suite: '', failedTests: 0, uniqueFailingTests: 0, sampleError: 'No failed tests in this run.' }];
  const trendRows = await buildFailureTrendRows(path.resolve('reports/result/excel-archive'), summaryRow);
  const trendSheetData = trendRows.length ? trendRows : [{
    sourceFile: '',
    taskName: '',
    runStartTime: '',
    runEndTime: '',
    totalDurationMinutes: 0,
    runResult: '',
    exitCode: 0,
    totalTests: 0,
    passed: 0,
    failed: 0,
    passRate: 0,
    failureRate: 0,
    flaky: 0,
    skipped: 0
  }];

  addWorksheetFromJson(workbook, 'RunSummary', [summaryRow]);
  addWorksheetFromJson(workbook, 'TestDetails', testRows);
  addWorksheetFromJson(workbook, 'FailureByModule', failureSheetData);
  addWorksheetFromJson(workbook, 'FailureTrend', trendSheetData);

  return workbook;
}

async function main() {
  const positionalArgs = args.filter((arg) => !arg.startsWith('--'));

  const jsonPath = path.resolve(getArg('--jsonPath', positionalArgs[0] || 'reports/result/json-report/results.json'));
  const outputPath = path.resolve(getArg('--outputPath', positionalArgs[1] || `reports/report/playwright-result-${Date.now()}.xlsx`));
  const latestOutputPath = path.resolve(getArg('--latestOutputPath', 'reports/result/last-run-results.xlsx'));
  const runStart = getArg('--runStart', positionalArgs[2] || '');
  const runEnd = getArg('--runEnd', positionalArgs[3] || '');
  const taskName = getArg('--taskName', positionalArgs[4] || 'Playwright_Daily_10PM');
  const testExitCode = Number(getArg('--testExitCode', positionalArgs[5] || '0'));

  const resultsJson = safeReadJson(jsonPath);
  const stats = (resultsJson && resultsJson.stats) ? resultsJson.stats : {};
  const suites = resultsJson && Array.isArray(resultsJson.suites) ? resultsJson.suites : [];
  const runErrors = resultsJson && Array.isArray(resultsJson.errors) ? resultsJson.errors : [];
  const firstRunError = runErrors.length && runErrors[0] && runErrors[0].message
    ? runErrors[0].message
    : '';

  const rows = [];
  collectTests(suites, rows);
  const discoveredRows = collectDiscoveredTests(process.cwd());
  const mergedRows = mergeMissingDiscoveredTests(rows, discoveredRows, firstRunError);

  const summary = {
    taskName,
    runStartTime: toIso(runStart),
    runEndTime: toIso(runEnd),
    totalDurationMinutes: runStart && runEnd
      ? Math.round((((new Date(runEnd).getTime() - new Date(runStart).getTime()) / 60000) * 100)) / 100
      : '',
    runResult: testExitCode === 0 ? 'PASSED' : 'FAILED',
    exitCode: testExitCode,
    totalTests: Number(stats.expected || 0) + Number(stats.unexpected || 0) + Number(stats.flaky || 0) + Number(stats.skipped || 0),
    passed: Number(stats.expected || 0),
    failed: Number(stats.unexpected || 0),
    flaky: Number(stats.flaky || 0),
    skipped: Number(stats.skipped || 0),
    jsonResultPath: jsonPath
  };

  ensureDirectory(path.dirname(outputPath));
  ensureDirectory(path.dirname(latestOutputPath));
  const workbook = await buildWorkbook(summary, mergedRows);
  await workbook.xlsx.writeFile(outputPath);
  await workbook.xlsx.writeFile(latestOutputPath);

  console.log(`Excel report generated: ${outputPath}`);
  console.log(`Latest Excel report updated: ${latestOutputPath}`);
}

main().catch((error) => {
  console.error(`Excel report generation failed: ${error.message}`);
  process.exit(1);
});
