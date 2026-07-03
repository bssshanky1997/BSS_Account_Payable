const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);

function getArg(flag, defaultValue = '') {
  const index = args.indexOf(flag);
  if (index === -1 || index === args.length - 1) return defaultValue;
  return args[index + 1];
}

function ensureDirectory(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function safeReadJson(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function toIso(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

function formatDuration(durationMs) {
  const seconds = Number(durationMs || 0) / 1000;
  if (seconds < 60) return `${seconds.toFixed(2)}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds.toFixed(2)}s`;
}

function toAbsPath(projectRoot, value) {
  if (!value) return '';
  if (path.isAbsolute(value)) return value;
  return path.resolve(projectRoot, value);
}

function stringifyErrorObject(errorObj) {
  if (!errorObj) return { reason: '', stackTrace: '' };

  const reason = String(errorObj.message || errorObj.value || '').trim();
  const stackTrace = String(errorObj.stack || errorObj.message || errorObj.value || '').trim();

  return { reason, stackTrace };
}

function collectAttachmentPaths(projectRoot, attachments) {
  const items = Array.isArray(attachments) ? attachments : [];
  const screenshotPaths = [];
  const tracePaths = [];
  const videoPaths = [];

  for (const attachment of items) {
    const attachmentName = String(attachment && attachment.name ? attachment.name : '').toLowerCase();
    const attachmentPath = toAbsPath(projectRoot, attachment && attachment.path ? attachment.path : '');
    if (!attachmentPath) continue;

    if (attachmentName.includes('screenshot') || attachmentPath.toLowerCase().endsWith('.png')) {
      screenshotPaths.push(attachmentPath);
      continue;
    }

    if (attachmentName.includes('trace') || attachmentPath.toLowerCase().endsWith('.zip')) {
      tracePaths.push(attachmentPath);
      continue;
    }

    if (attachmentName.includes('video') || attachmentPath.toLowerCase().endsWith('.webm')) {
      videoPaths.push(attachmentPath);
    }
  }

  return { screenshotPaths, tracePaths, videoPaths };
}

function deriveStatus(test, result, isLatestAttempt = true) {
  const resultStatus = String((result && result.status) || '').toLowerCase();
  if (resultStatus === 'passed') return 'PASS';
  if (resultStatus === 'skipped') return 'SKIPPED';
  if (resultStatus === 'failed' || resultStatus === 'timedout' || resultStatus === 'interrupted') return 'FAIL';

  if (!isLatestAttempt) return 'SKIPPED';

  const outcome = String(test && test.outcome ? test.outcome : '').toLowerCase();
  if (outcome === 'unexpected') return 'FAIL';
  if (outcome === 'skipped') return 'SKIPPED';
  if (outcome === 'flaky') return 'PASS';

  const expectedStatus = String(test && test.expectedStatus ? test.expectedStatus : '').toLowerCase();
  if (expectedStatus === 'skipped') return 'SKIPPED';

  return 'SKIPPED';
}

function collectTestsFromPlaywrightJson(projectRoot, suites, records, parentSuite = '') {
  if (!Array.isArray(suites)) return;

  for (const suite of suites) {
    const suiteTitle = [parentSuite, suite.title || ''].filter(Boolean).join(' > ');
    const specs = Array.isArray(suite.specs) ? suite.specs : [];

    for (const spec of specs) {
      const tests = Array.isArray(spec.tests) ? spec.tests : [];

      for (const test of tests) {
        const results = Array.isArray(test.results) ? test.results : [];
        if (!results.length) {
          const derivedStatus = deriveStatus(test, null, true);
          records.push({
            file: spec.file || '',
            suite: suiteTitle,
            testCaseKey: `${spec.file || ''}::${spec.title || ''}`,
            testCaseName: spec.title || '',
            executionStatus: derivedStatus,
            attempt: 0,
            attemptLabel: 'Final',
            isLatestAttempt: true,
            startTime: '',
            endTime: '',
            duration: formatDuration(0),
            durationMs: 0,
            failureReason: '',
            stackTrace: '',
            screenshotPaths: [],
            tracePaths: [],
            videoPaths: []
          });
          continue;
        }

        for (let attemptIndex = 0; attemptIndex < results.length; attemptIndex += 1) {
          const currentResult = results[attemptIndex];
          const isLatestAttempt = attemptIndex === results.length - 1;
          const derivedStatus = deriveStatus(test, currentResult, isLatestAttempt);
          const startTime = currentResult && currentResult.startTime ? toIso(currentResult.startTime) : '';
          const durationMs = currentResult && currentResult.duration ? Number(currentResult.duration) : 0;
          const endTime = startTime ? toIso(new Date(startTime).getTime() + durationMs) : '';
          const errors = [];

          if (currentResult && currentResult.error) errors.push(currentResult.error);
          if (currentResult && Array.isArray(currentResult.errors)) errors.push(...currentResult.errors);

          const normalizedErrors = errors.map(stringifyErrorObject).filter((item) => item.reason || item.stackTrace);
          const firstError = normalizedErrors.length ? normalizedErrors[0] : { reason: '', stackTrace: '' };
          const attachmentPaths = collectAttachmentPaths(projectRoot, currentResult ? currentResult.attachments : []);
          const retryNumber = currentResult && Number.isFinite(Number(currentResult.retry))
            ? Number(currentResult.retry)
            : attemptIndex;

          records.push({
            file: spec.file || '',
            suite: suiteTitle,
            testCaseKey: `${spec.file || ''}::${spec.title || ''}`,
            testCaseName: spec.title || '',
            executionStatus: derivedStatus,
            attempt: retryNumber,
            attemptLabel: `Attempt ${retryNumber + 1}${isLatestAttempt ? ' (final)' : ''}`,
            isLatestAttempt,
            startTime,
            endTime,
            duration: formatDuration(durationMs),
            durationMs,
            failureReason: firstError.reason,
            stackTrace: firstError.stackTrace,
            screenshotPaths: attachmentPaths.screenshotPaths,
            tracePaths: attachmentPaths.tracePaths,
            videoPaths: attachmentPaths.videoPaths
          });
        }
      }
    }

    collectTestsFromPlaywrightJson(projectRoot, suite.suites, records, suiteTitle);
  }
}

function walkFiles(dirPath, collector) {
  if (!fs.existsSync(dirPath)) return;

  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      walkFiles(fullPath, collector);
    }
    else {
      collector(fullPath);
    }
  }
}

function extractTestTitlesFromSource(content) {
  const titles = [];
  const regex = /\btest(?:\.(?:only|skip|fixme|fail|slow))?\s*\(\s*(['"`])((?:\\.|(?!\1)[\s\S])*?)\1/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    const title = String(match[2] || '').trim();
    if (!title || title.includes('${')) continue;
    titles.push(title);
  }
  return titles;
}

function discoverTestCasesFromSource(projectRoot) {
  const discovered = [];
  const seen = new Set();
  const sourceDirs = ['tests', 'Test_Classes'];

  for (const sourceDir of sourceDirs) {
    walkFiles(path.join(projectRoot, sourceDir), (filePath) => {
      if (!/\.(ts|js)$/i.test(filePath) || /\.d\.ts$/i.test(filePath)) return;
      const content = fs.readFileSync(filePath, 'utf8');
      const titles = extractTestTitlesFromSource(content);
      const relativeFile = path.relative(projectRoot, filePath).replace(/\\/g, '/');

      for (const title of titles) {
        const key = `${relativeFile}::${title}`;
        if (seen.has(key)) continue;
        seen.add(key);
        discovered.push({
          file: relativeFile,
          suite: '',
          testCaseName: title
        });
      }
    });
  }

  return discovered;
}

function mergeWithDiscoveredTests(testRows, discoveredTests, frameworkError) {
  const merged = [...testRows];
  const existing = new Set(
    testRows.map((row) => row.testCaseKey || `${row.file || ''}::${row.testCaseName || ''}`)
  );

  for (const testCase of discoveredTests) {
    const key = `${testCase.file || ''}::${testCase.testCaseName || ''}`;
    if (existing.has(key)) continue;

    merged.push({
      file: testCase.file || '',
      suite: '',
      testCaseKey: key,
      testCaseName: testCase.testCaseName || '',
      executionStatus: 'SKIPPED',
      attempt: 0,
      attemptLabel: 'Final',
      isLatestAttempt: true,
      startTime: '',
      endTime: '',
      duration: formatDuration(0),
      durationMs: 0,
      failureReason: frameworkError ? `Not executed due to framework error: ${frameworkError}` : 'Not executed due to early run failure.',
      stackTrace: frameworkError || '',
      screenshotPaths: [],
      tracePaths: [],
      videoPaths: []
    });
  }

  return merged;
}

function buildExecutionSummary(rows, taskName, runStart, runEnd, exitCode, jsonPath) {
  const summaryRows = rows.filter((row) => row.isLatestAttempt !== false);
  const totalTests = summaryRows.length;
  const passedTests = summaryRows.filter((row) => row.executionStatus === 'PASS').length;
  const failedTests = summaryRows.filter((row) => row.executionStatus === 'FAIL').length;
  const skippedTests = summaryRows.filter((row) => row.executionStatus === 'SKIPPED').length;
  const passPercentage = totalTests > 0 ? Math.round((passedTests / totalTests) * 10000) / 100 : 0;

  return {
    taskName,
    runStartTime: toIso(runStart),
    runEndTime: toIso(runEnd),
    totalDuration: runStart && runEnd
      ? formatDuration(new Date(runEnd).getTime() - new Date(runStart).getTime())
      : '',
    executionResult: exitCode === 0 ? 'PASSED' : 'FAILED',
    exitCode: Number(exitCode || 0),
    totalTests,
    passedTests,
    failedTests,
    skippedTests,
    passPercentage,
    jsonResultPath: jsonPath
  };
}

function ensureFrameworkFailureIsTracked(rows, frameworkErrors) {
  if (!Array.isArray(frameworkErrors) || !frameworkErrors.length) return rows;

  const hasFailedRow = rows.some((row) => row.executionStatus === 'FAIL');
  if (hasFailedRow) return rows;

  const firstError = String(frameworkErrors[0] || '').trim();
  return [
    {
      file: '',
      suite: 'Framework',
      testCaseKey: '__framework_global_setup_failure__',
      testCaseName: 'Framework / Global Setup Failure',
      executionStatus: 'FAIL',
      attempt: 0,
      attemptLabel: 'Final',
      isLatestAttempt: true,
      startTime: '',
      endTime: '',
      duration: formatDuration(0),
      durationMs: 0,
      failureReason: firstError || 'Framework failed before test execution.',
      stackTrace: firstError,
      screenshotPaths: [],
      tracePaths: [],
      videoPaths: []
    },
    ...rows
  ];
}

function renderSummaryCards(summary) {
  const cards = [
    { label: 'Total Tests', value: summary.totalTests },
    { label: 'Passed', value: summary.passedTests },
    { label: 'Failed', value: summary.failedTests },
    { label: 'Skipped', value: summary.skippedTests },
    { label: 'Pass %', value: `${summary.passPercentage}%` }
  ];

  return cards.map((card) => `
    <div class="card">
      <div class="card-label">${escapeHtml(card.label)}</div>
      <div class="card-value">${escapeHtml(card.value)}</div>
    </div>
  `).join('');
}

function renderDetailedRows(rows) {
  return rows.map((row) => `
    <tr>
      <td>${escapeHtml(row.file || '-')}</td>
      <td>${escapeHtml(row.suite || '-')}</td>
      <td>${escapeHtml(row.testCaseName)}</td>
      <td><span class="badge ${row.executionStatus.toLowerCase()}">${escapeHtml(row.executionStatus)}</span></td>
      <td>${escapeHtml(row.attemptLabel || 'Final')}</td>
      <td>${escapeHtml(row.startTime || '-')}</td>
      <td>${escapeHtml(row.endTime || '-')}</td>
      <td>${escapeHtml(row.duration)}</td>
      <td>${escapeHtml(row.failureReason || '-')}</td>
      <td>
        ${row.stackTrace ? `<details><summary>View Error</summary><pre>${escapeHtml(row.stackTrace)}</pre></details>` : '-'}
      </td>
      <td>${escapeHtml(row.screenshotPaths.join(' | ') || '-')}</td>
      <td>${escapeHtml(row.tracePaths.join(' | ') || '-')}</td>
      <td>${escapeHtml(row.videoPaths.join(' | ') || '-')}</td>
    </tr>
  `).join('');
}

function renderFailedRows(failedRows) {
  if (!failedRows.length) {
    return '<tr><td colspan="6">No failed tests in this run.</td></tr>';
  }

  return failedRows.map((row) => `
    <tr>
      <td>${escapeHtml(row.testCaseName)}</td>
      <td>${escapeHtml(row.failureReason || 'Unknown failure')}</td>
      <td>${escapeHtml(row.screenshotPaths.join(' | ') || '-')}</td>
      <td>${escapeHtml(row.tracePaths.join(' | ') || '-')}</td>
      <td>${escapeHtml(row.videoPaths.join(' | ') || '-')}</td>
      <td>
        ${row.stackTrace ? `<details><summary>View Stack Trace</summary><pre>${escapeHtml(row.stackTrace)}</pre></details>` : '-'}
      </td>
    </tr>
  `).join('');
}

function buildDetailedHtml(summary, rows, failedRows, frameworkErrors) {
  const finalAttemptRows = rows.filter((row) => row.isLatestAttempt !== false);
  const frameworkErrorBanner = frameworkErrors.length
    ? `<div class="framework-errors"><strong>Framework errors detected:</strong><br>${frameworkErrors.map((item) => escapeHtml(item)).join('<br>')}</div>`
    : '';

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Nightly Execution Detailed Report</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 24px; color: #1f2937; }
    h1, h2 { margin-bottom: 8px; }
    .meta { margin-bottom: 16px; color: #4b5563; }
    .card-grid { display: grid; grid-template-columns: repeat(5, minmax(120px, 1fr)); gap: 10px; margin: 16px 0 24px; }
    .card { border: 1px solid #d1d5db; border-radius: 8px; padding: 12px; background: #f9fafb; }
    .card-label { font-size: 12px; color: #6b7280; text-transform: uppercase; }
    .card-value { font-size: 24px; font-weight: 700; margin-top: 6px; }
    .framework-errors { border: 1px solid #fca5a5; background: #fef2f2; color: #991b1b; padding: 12px; border-radius: 6px; margin-bottom: 16px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; margin-bottom: 20px; }
    th, td { border: 1px solid #e5e7eb; padding: 8px; text-align: left; vertical-align: top; }
    th { background: #f3f4f6; position: sticky; top: 0; }
    .badge { padding: 2px 8px; border-radius: 999px; color: #fff; font-size: 12px; font-weight: 700; display: inline-block; }
    .badge.pass { background: #16a34a; }
    .badge.fail { background: #dc2626; }
    .badge.skipped { background: #6b7280; }
    pre { white-space: pre-wrap; max-width: 800px; }
  </style>
</head>
<body>
  <h1>Nightly Execution Detailed Report</h1>
  <div class="meta">
    <div><strong>Task:</strong> ${escapeHtml(summary.taskName)}</div>
    <div><strong>Run Start:</strong> ${escapeHtml(summary.runStartTime || '-')}</div>
    <div><strong>Run End:</strong> ${escapeHtml(summary.runEndTime || '-')}</div>
    <div><strong>Total Duration:</strong> ${escapeHtml(summary.totalDuration || '-')}</div>
    <div><strong>Execution Result:</strong> ${escapeHtml(summary.executionResult)}</div>
  </div>
  ${frameworkErrorBanner}
  <div class="card-grid">${renderSummaryCards(summary)}</div>

  <h2>All Test Cases</h2>
  <table>
    <thead>
      <tr>
        <th>File</th>
        <th>Suite</th>
        <th>Test Case Name</th>
        <th>Status</th>
        <th>Execution Attempt</th>
        <th>Start Time</th>
        <th>End Time</th>
        <th>Duration</th>
        <th>Failure Reason</th>
        <th>Error Message</th>
        <th>Screenshot Path</th>
        <th>Trace Path</th>
        <th>Video Path</th>
      </tr>
    </thead>
    <tbody>
      ${renderDetailedRows(finalAttemptRows)}
    </tbody>
  </table>

  <h2>Failed Tests</h2>
  <table>
    <thead>
      <tr>
        <th>Test Name</th>
        <th>Failure Reason</th>
        <th>Screenshot Path</th>
        <th>Trace Path</th>
        <th>Video Path</th>
        <th>Stack Trace</th>
      </tr>
    </thead>
    <tbody>
      ${renderFailedRows(failedRows)}
    </tbody>
  </table>
</body>
</html>`;
}

function buildEmailSummaryHtml(summary, failedRows) {
  const failedPreview = failedRows.length
    ? failedRows.slice(0, 10).map((row) => `<li><strong>${escapeHtml(row.testCaseName)}</strong> - ${escapeHtml(row.failureReason || 'Unknown failure')}</li>`).join('')
    : '<li>No failed tests.</li>';

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Nightly Playwright Execution Summary</title>
  <style>
    body { font-family: Arial, sans-serif; color: #111827; }
    .container { max-width: 760px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; }
    h2 { margin-top: 0; }
    .result { font-weight: 700; color: ${summary.executionResult === 'PASSED' ? '#16a34a' : '#dc2626'}; }
    ul { margin-top: 6px; }
  </style>
</head>
<body>
  <div class="container">
    <h2>Nightly Playwright Execution Summary</h2>
    <p><strong>Task:</strong> ${escapeHtml(summary.taskName)}</p>
    <p><strong>Run Window:</strong> ${escapeHtml(summary.runStartTime || '-')} to ${escapeHtml(summary.runEndTime || '-')}</p>
    <p><strong>Status:</strong> <span class="result">${escapeHtml(summary.executionResult)}</span></p>
    <p><strong>Total:</strong> ${summary.totalTests} | <strong>Passed:</strong> ${summary.passedTests} | <strong>Failed:</strong> ${summary.failedTests} | <strong>Skipped:</strong> ${summary.skippedTests} | <strong>Pass %:</strong> ${summary.passPercentage}%</p>
    <p><strong>Top Failed Tests:</strong></p>
    <ul>${failedPreview}</ul>
  </div>
</body>
</html>`;
}

function main() {
  const projectRoot = path.resolve(getArg('--projectRoot', process.cwd()));
  const jsonPath = path.resolve(getArg('--jsonPath', 'reports/result/json-report/results.json'));
  const outputDir = path.resolve(getArg('--outputDir', 'Reports'));
  const runStart = getArg('--runStart', '');
  const runEnd = getArg('--runEnd', '');
  const taskName = getArg('--taskName', 'Playwright_Daily_10PM');
  const exitCode = Number(getArg('--testExitCode', '0'));

  const resultJson = safeReadJson(jsonPath) || {};
  const suites = Array.isArray(resultJson.suites) ? resultJson.suites : [];
  const runErrors = Array.isArray(resultJson.errors) ? resultJson.errors : [];
  const frameworkErrors = runErrors.map((error) => String(error && error.message ? error.message : '')).filter(Boolean);
  const frameworkErrorMessage = frameworkErrors.length ? frameworkErrors[0] : '';

  const testRows = [];
  collectTestsFromPlaywrightJson(projectRoot, suites, testRows);
  const discoveredTests = discoverTestCasesFromSource(projectRoot);
  const mergedRows = mergeWithDiscoveredTests(testRows, discoveredTests, frameworkErrorMessage);
  const allRows = ensureFrameworkFailureIsTracked(mergedRows, frameworkErrors)
    .sort((a, b) => {
      const byName = a.testCaseName.localeCompare(b.testCaseName);
      if (byName !== 0) return byName;
      return Number(a.attempt || 0) - Number(b.attempt || 0);
    });

  const summary = buildExecutionSummary(allRows, taskName, runStart, runEnd, exitCode, jsonPath);
  const failedRows = allRows
    .filter((row) => row.isLatestAttempt !== false)
    .filter((row) => row.executionStatus === 'FAIL')
    .map((row) => ({
    testCaseName: row.testCaseName,
    failureReason: row.failureReason,
    stackTrace: row.stackTrace,
    screenshotPaths: row.screenshotPaths,
    tracePaths: row.tracePaths,
    videoPaths: row.videoPaths
    }));

  const detailedHtml = buildDetailedHtml(summary, allRows, failedRows, frameworkErrors);
  const emailSummaryHtml = buildEmailSummaryHtml(summary, failedRows);

  ensureDirectory(outputDir);
  fs.writeFileSync(path.join(outputDir, 'detailed-execution-report.html'), detailedHtml, 'utf8');
  fs.writeFileSync(path.join(outputDir, 'execution-summary.json'), JSON.stringify(summary, null, 2), 'utf8');
  fs.writeFileSync(path.join(outputDir, 'failed-tests.json'), JSON.stringify(failedRows, null, 2), 'utf8');
  fs.writeFileSync(path.join(outputDir, 'email-summary.html'), emailSummaryHtml, 'utf8');

  console.log(`Detailed report generated: ${path.join(outputDir, 'detailed-execution-report.html')}`);
  console.log(`Execution summary generated: ${path.join(outputDir, 'execution-summary.json')}`);
  console.log(`Failed tests generated: ${path.join(outputDir, 'failed-tests.json')}`);
  console.log(`Email summary generated: ${path.join(outputDir, 'email-summary.html')}`);
}

main();
