import { DashboardMetrics } from './Dashboard';
import {
  ReportHeaderMetadata,
  NormalizedAttachment,
  NormalizedStep,
  NormalizedTestCase,
  escapeHtml,
  formatDuration,
} from './ReportUtils';

/**
 * Renders HTML for individual test steps.
 */
function renderSteps(steps: NormalizedStep[]): string {
  if (steps.length === 0) {
    return '<li class="empty-value">Not Provided</li>';
  }

  return steps
    .map(
      (step) => `
        <li class="step-item">
          <span class="step-title">${escapeHtml(step.title)}</span>
          <span class="step-meta">${escapeHtml(step.status.toUpperCase())} • ${escapeHtml(formatDuration(step.durationMs))}</span>
          ${step.errorMessage ? `<pre class="step-error">${escapeHtml(step.errorMessage)}</pre>` : ''}
        </li>
      `
    )
    .join('\n');
}

/**
 * Renders attachment list entries.
 */
function renderAttachmentList(attachments: NormalizedAttachment[]): string {
  if (attachments.length === 0) {
    return '<li class="empty-value">Not Provided</li>';
  }

  return attachments
    .map(
      (attachment) => `
        <li>
          <a href="${escapeHtml(attachment.path)}" target="_blank" rel="noopener noreferrer">
            ${escapeHtml(attachment.name)} (${escapeHtml(attachment.kind)})
          </a>
        </li>
      `
    )
    .join('\n');
}

/**
 * Renders screenshot gallery cards.
 */
function renderScreenshotGallery(attachments: NormalizedAttachment[]): string {
  const screenshotAttachments = attachments.filter((attachment) => attachment.kind === 'screenshot');
  if (screenshotAttachments.length === 0) {
    return '<p class="empty-value">No screenshots available.</p>';
  }

  return `
    <div class="screenshot-gallery">
      ${screenshotAttachments
        .map(
          (attachment) => `
            <a class="gallery-item" href="${escapeHtml(attachment.path)}" target="_blank" rel="noopener noreferrer">
              <img src="${escapeHtml(attachment.path)}" alt="${escapeHtml(attachment.name)}" loading="lazy" />
              <span>${escapeHtml(attachment.name)}</span>
            </a>
          `
        )
        .join('\n')}
    </div>
  `;
}

/**
 * Renders logs in a readable multiline block.
 */
function renderConsoleLogs(logs: string[]): string {
  if (logs.length === 0) {
    return '<pre class="log-block">Not Provided</pre>';
  }
  return `<pre class="log-block">${escapeHtml(logs.join('\n'))}</pre>`;
}

/**
 * Renders status and duration badges shared by both templates.
 */
function renderCommonBadges(testCase: NormalizedTestCase): string {
  return `
    <div class="test-badges">
      <span class="status-badge status-${escapeHtml(testCase.status)}">${escapeHtml(testCase.status.toUpperCase())}</span>
      <span class="duration-badge">${escapeHtml(formatDuration(testCase.executionTimeMs))}</span>
    </div>
  `;
}

/**
 * Renders functional suite layout with full test narrative.
 */
function renderFunctionalTemplate(testCase: NormalizedTestCase): string {
  return `
    <article class="test-card" data-status="${escapeHtml(testCase.status)}" data-suite="${escapeHtml(testCase.suiteType)}" data-search="${escapeHtml(`${testCase.tcId} ${testCase.testName}`.toLowerCase())}">
      <header class="test-card-header">
        <div class="test-heading">
          <h3>${escapeHtml(testCase.testName)}</h3>
          <p class="tc-id">TC ID: ${escapeHtml(testCase.tcId)}</p>
        </div>
        ${renderCommonBadges(testCase)}
      </header>

      <section class="test-summary-grid">
        <div><strong>Description</strong><p>${escapeHtml(testCase.description)}</p></div>
        <div><strong>Preconditions</strong><p>${escapeHtml(testCase.preconditions)}</p></div>
        <div><strong>Test Data</strong><p>${escapeHtml(testCase.testData)}</p></div>
        <div><strong>Expected Result</strong><p>${escapeHtml(testCase.expectedResult)}</p></div>
        <div><strong>Actual Result</strong><p>${escapeHtml(testCase.actualResult)}</p></div>
        <div><strong>Browser / Environment</strong><p>${escapeHtml(testCase.browser)} / ${escapeHtml(testCase.environment)}</p></div>
      </section>

      <details class="test-details">
        <summary>View Detailed Execution</summary>
        <div class="details-content">
          <section>
            <h4>Test Steps</h4>
            <ul class="step-list">
              ${renderSteps(testCase.testSteps)}
            </ul>
          </section>

          <section>
            <h4>Error Message</h4>
            <pre class="log-block">${escapeHtml(testCase.errorMessage || 'Not Provided')}</pre>
          </section>

          <section>
            <h4>Stack Trace</h4>
            <pre class="log-block">${escapeHtml(testCase.stackTrace || 'Not Provided')}</pre>
          </section>

          <section>
            <h4>Attachments</h4>
            <ul class="attachment-list">
              ${renderAttachmentList(testCase.attachments)}
            </ul>
          </section>

          <section>
            <h4>Screenshots</h4>
            ${renderScreenshotGallery(testCase.attachments)}
          </section>

          <section>
            <h4>Console Logs</h4>
            ${renderConsoleLogs(testCase.consoleLogs)}
          </section>
        </div>
      </details>
    </article>
  `;
}

/**
 * Renders compact regression suite layout.
 */
function renderRegressionTemplate(testCase: NormalizedTestCase): string {
  const failedScreenshotHtml = testCase.failedScreenshotPath
    ? `<a href="${escapeHtml(testCase.failedScreenshotPath)}" target="_blank" rel="noopener noreferrer">Open Failed Screenshot</a>`
    : '<span class="empty-value">Not Provided</span>';

  const traceHtml = testCase.tracePath
    ? `<a href="${escapeHtml(testCase.tracePath)}" target="_blank" rel="noopener noreferrer">Open Trace</a>`
    : '<span class="empty-value">Not Provided</span>';

  const videoHtml = testCase.videoPath
    ? `<a href="${escapeHtml(testCase.videoPath)}" target="_blank" rel="noopener noreferrer">Open Video</a>`
    : '<span class="empty-value">Not Provided</span>';

  return `
    <article class="test-card" data-status="${escapeHtml(testCase.status)}" data-suite="${escapeHtml(testCase.suiteType)}" data-search="${escapeHtml(`${testCase.testName}`.toLowerCase())}">
      <header class="test-card-header">
        <div class="test-heading">
          <h3>${escapeHtml(testCase.testName)}</h3>
          <p class="tc-id">Suite: Regression_Test</p>
        </div>
        ${renderCommonBadges(testCase)}
      </header>

      <section class="test-summary-grid">
        <div><strong>Browser</strong><p>${escapeHtml(testCase.browser)}</p></div>
        <div><strong>Error Message</strong><p>${escapeHtml(testCase.errorMessage || 'Not Provided')}</p></div>
        <div><strong>Failed Screenshot</strong><p>${failedScreenshotHtml}</p></div>
        <div><strong>Trace</strong><p>${traceHtml}</p></div>
        <div><strong>Video</strong><p>${videoHtml}</p></div>
      </section>

      <details class="test-details">
        <summary>View Logs</summary>
        <div class="details-content">
          <section>
            <h4>Logs</h4>
            ${renderConsoleLogs(testCase.consoleLogs)}
          </section>
        </div>
      </details>
    </article>
  `;
}

/**
 * Builds suite-aware report title.
 */
function buildReportTitle(testCases: NormalizedTestCase[]): string {
  const suiteSet = new Set(testCases.map((testCase) => testCase.suiteType));
  if (suiteSet.size === 1 && suiteSet.has('regression')) {
    return 'Regression_Test Report';
  }
  if (suiteSet.size === 1 && suiteSet.has('functional')) {
    return 'Functional_Test Report';
  }
  return 'Functional_Test + Regression_Test Report';
}

/**
 * Routes card rendering to suite-specific template.
 */
function renderTestCaseCard(testCase: NormalizedTestCase): string {
  if (testCase.suiteType === 'functional') {
    return renderFunctionalTemplate(testCase);
  }

  if (testCase.suiteType === 'regression') {
    return renderRegressionTemplate(testCase);
  }

  // Unknown suites default to compact template.
  return renderRegressionTemplate(testCase);
}

/**
 * Builds final report HTML content with modular sections.
 */
export function buildHtmlReport(
  header: ReportHeaderMetadata,
  metrics: DashboardMetrics,
  testCases: NormalizedTestCase[],
  embeddedJson: string
): string {
  const reportTitle = buildReportTitle(testCases);

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Enterprise Automation Report</title>
  <link rel="stylesheet" href="./assets/css/custom-reporter.css" />
</head>
<body>
  <main class="container">
    <section class="report-header">
      <div class="report-title-wrap">
        <h1>${escapeHtml(reportTitle)}</h1>
        <p>Auto-detected suite layout report.</p>
      </div>
      <div class="header-grid">
        <div><span>Company Name</span><strong>${escapeHtml(header.companyName)}</strong></div>
        <div><span>Subscriber ID</span><strong>${escapeHtml(header.subscriberId)}</strong></div>
        <div><span>Company ID</span><strong>${escapeHtml(header.companyId)}</strong></div>
        <div><span>Build Number</span><strong>${escapeHtml(header.buildNumber)}</strong></div>
        <div><span>Run ID</span><strong>${escapeHtml(header.runId)}</strong></div>
        <div><span>Execution Date</span><strong>${escapeHtml(header.executionDate)}</strong></div>
        <div><span>Browser</span><strong>${escapeHtml(header.browser)}</strong></div>
        <div><span>Environment</span><strong>${escapeHtml(header.environment)}</strong></div>
        <div><span>Total Execution Time</span><strong>${escapeHtml(header.totalExecutionTime)}</strong></div>
      </div>
    </section>

    <section class="dashboard">
      <h2>Dashboard</h2>
      <div class="kpi-grid">
        <article><span>Total Tests</span><strong>${metrics.totalTests}</strong></article>
        <article><span>Passed</span><strong>${metrics.passed}</strong></article>
        <article><span>Failed</span><strong>${metrics.failed}</strong></article>
        <article><span>Blocked</span><strong>${metrics.blocked}</strong></article>
        <article><span>Skipped</span><strong>${metrics.skipped}</strong></article>
        <article><span>Pass Percentage</span><strong>${metrics.passPercentage}%</strong></article>
      </div>
    </section>

    <section class="toolbar">
      <h2>Top Toolbar</h2>
      <div class="toolbar-actions">
        <input id="searchInput" type="text" placeholder="Search Test Cases" />
        <button data-filter="all" class="toolbar-button">All</button>
        <button data-filter="passed" class="toolbar-button">Filter by Pass</button>
        <button data-filter="failed" class="toolbar-button">Filter by Fail</button>
        <button data-filter="blocked" class="toolbar-button">Filter by Blocked</button>
        <button data-filter="skipped" class="toolbar-button">Filter by Skipped</button>
        <button data-suite-filter="all" class="toolbar-button">All Suites</button>
        <button data-suite-filter="functional" class="toolbar-button">Functional_Test</button>
        <button data-suite-filter="regression" class="toolbar-button">Regression_Test</button>
        <button id="expandAll" class="toolbar-button">Expand All</button>
        <button id="collapseAll" class="toolbar-button">Collapse All</button>
        <button id="downloadJson" class="toolbar-button">Download JSON</button>
        <button id="downloadPdf" class="toolbar-button">Download PDF</button>
      </div>
    </section>

    <section class="testcases">
      <h2>Test Cases</h2>
      <div id="testCards">
        ${testCases.map((testCase) => renderTestCaseCard(testCase)).join('\n')}
      </div>
    </section>
  </main>

  <script id="report-data" type="application/json">${escapeHtml(embeddedJson)}</script>
  <script src="./assets/js/custom-reporter.js"></script>
</body>
</html>
  `.trim();
}
