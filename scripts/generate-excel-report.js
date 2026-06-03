const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

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

function buildFailureTrendRows(trendDir, currentSummary, maxRows = 30) {
  const trendRows = [];

  if (fs.existsSync(trendDir)) {
    const files = fs.readdirSync(trendDir)
      .filter((name) => name.toLowerCase().endsWith('.xlsx'))
      .map((name) => path.join(trendDir, name));

    for (const filePath of files) {
      try {
        const workbook = XLSX.readFile(filePath);
        const runSummarySheet = workbook.Sheets.RunSummary;
        if (!runSummarySheet) continue;

        const rows = XLSX.utils.sheet_to_json(runSummarySheet, { defval: '' });
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

function buildWorkbook(summaryRow, testRows) {
  const workbook = XLSX.utils.book_new();

  const summarySheet = XLSX.utils.json_to_sheet([summaryRow]);
  const testsSheet = XLSX.utils.json_to_sheet(testRows);
  const failureRows = buildFailureSummaryRows(testRows);
  const failureSheetData = failureRows.length
    ? failureRows
    : [{ file: '', suite: '', failedTests: 0, uniqueFailingTests: 0, sampleError: 'No failed tests in this run.' }];
  const failuresSheet = XLSX.utils.json_to_sheet(failureSheetData);
  const trendRows = buildFailureTrendRows(path.resolve('excel-archive'), summaryRow);
  const trendSheet = XLSX.utils.json_to_sheet(trendRows.length ? trendRows : [{
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
  }]);

  XLSX.utils.book_append_sheet(workbook, summarySheet, 'RunSummary');
  XLSX.utils.book_append_sheet(workbook, testsSheet, 'TestDetails');
  XLSX.utils.book_append_sheet(workbook, failuresSheet, 'FailureByModule');
  XLSX.utils.book_append_sheet(workbook, trendSheet, 'FailureTrend');

  return workbook;
}

function main() {
  const positionalArgs = args.filter((arg) => !arg.startsWith('--'));

  const jsonPath = path.resolve(getArg('--jsonPath', positionalArgs[0] || 'reports/json-report/results.json'));
  const outputPath = path.resolve(getArg('--outputPath', positionalArgs[1] || `reports/excel-report/playwright-result-${Date.now()}.xlsx`));
  const runStart = getArg('--runStart', positionalArgs[2] || '');
  const runEnd = getArg('--runEnd', positionalArgs[3] || '');
  const taskName = getArg('--taskName', positionalArgs[4] || 'Playwright_Daily_10PM');
  const testExitCode = Number(getArg('--testExitCode', positionalArgs[5] || '0'));

  const resultsJson = safeReadJson(jsonPath);
  const stats = (resultsJson && resultsJson.stats) ? resultsJson.stats : {};
  const suites = resultsJson && Array.isArray(resultsJson.suites) ? resultsJson.suites : [];

  const rows = [];
  collectTests(suites, rows);

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
  const workbook = buildWorkbook(summary, rows);
  XLSX.writeFile(workbook, outputPath);

  console.log(`Excel report generated: ${outputPath}`);
}

main();
