import fs from 'fs';
import path from 'path';
import type {
  FullConfig,
  FullResult,
  Reporter,
  Suite,
  TestCase,
  TestResult,
  TestStep,
} from '@playwright/test/reporter';
import { computeDashboardMetrics } from './Dashboard';
import { buildHtmlReport } from './HtmlBuilder';
import {
  ReportHeaderMetadata,
  NormalizedAttachment,
  NormalizedStep,
  NormalizedTestCase,
  createStableId,
  deriveNarrativeText,
  detectSuiteType,
  detectAttachmentKind,
  extractExpectedAndActual,
  extractTcId,
  formatDuration,
  formatExecutionDate,
  getFirstAttachmentPathByKind,
  getReportRelativePath,
  normalizeStatus,
  valueOrFallback,
} from './ReportUtils';

interface CustomReporterOptions {
  outputDir?: string;
  assetsDir?: string;
  companyName?: string;
  subscriberId?: string;
  companyId?: string;
  cdNumber?: string;
  buildNumber?: string;
  runId?: string;
  environment?: string;
}

/**
 * Enterprise-grade custom HTML reporter for Playwright.
 * Add this reporter in playwright.config.ts without changing existing tests/POM code.
 */
class CustomReporter implements Reporter {
  private config!: FullConfig;
  private readonly options: CustomReporterOptions;
  private readonly testCases: NormalizedTestCase[] = [];
  private runStartTimeMs = 0;
  private runEndTimeMs = 0;
  private resolvedOutputDir = '';
  private resolvedAssetsSourceDir = '';

  constructor(options: CustomReporterOptions = {}) {
    this.options = options;
  }

  onBegin(config: FullConfig, _suite: Suite): void {
    this.config = config;
    this.runStartTimeMs = Date.now();

    this.resolvedOutputDir = path.resolve(process.cwd(), this.options.outputDir ?? 'Reports/custom-html-report');
    this.resolvedAssetsSourceDir = path.resolve(process.cwd(), this.options.assetsDir ?? 'report-assets');

    fs.mkdirSync(this.resolvedOutputDir, { recursive: true });
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    const errorMessage = result.error?.message ?? '';
    const stackTrace = result.error?.stack ?? '';
    const status = normalizeStatus(
      result.status,
      (test.annotations ?? []).map((annotation) => ({
        type: annotation.type,
        description: annotation.description,
      })),
      errorMessage
    );

    const steps = this.flattenSteps(result.steps ?? []);
    const executionTimeMs = Number.isFinite(result.duration) ? result.duration : 0;
    const testName = this.resolveDisplayTestName(test);
    const tcId = extractTcId(testName);
    const narrative = deriveNarrativeText(testName, steps);
    const expectedActual = extractExpectedAndActual(errorMessage);
    const browser = valueOrFallback(this.tryGetProjectName(test), 'chromium');
    const environment = valueOrFallback(
      process.env.TEST_ENV || process.env.ENV || this.options.environment,
      'QA'
    );

    const attachments = this.normalizeAttachments(result);
    const normalizedTestCase: NormalizedTestCase = {
      id: createStableId(`${test.location.file}-${test.location.line}-${testName}`),
      tcId,
      testName,
      suiteType: detectSuiteType(test.location.file),
      status,
      executionTimeMs,
      description: narrative.description,
      preconditions: narrative.preconditions,
      testData: narrative.testData,
      testSteps: steps,
      expectedResult: expectedActual.expected !== 'Not Provided' ? expectedActual.expected : narrative.expectedResult,
      actualResult: expectedActual.actual,
      errorMessage: errorMessage || 'Not Provided',
      stackTrace: stackTrace || 'Not Provided',
      attachments,
      consoleLogs: this.extractConsoleLogs(result),
      suitePath: test.titlePath().slice(0, -1),
      browser,
      environment,
      failedScreenshotPath: getFirstAttachmentPathByKind(attachments, 'screenshot'),
      tracePath: getFirstAttachmentPathByKind(attachments, 'trace'),
      videoPath: getFirstAttachmentPathByKind(attachments, 'video'),
    };

    this.testCases.push(normalizedTestCase);
  }

  async onEnd(result: FullResult): Promise<void> {
    this.runEndTimeMs = Date.now();
    const durationMs = this.runEndTimeMs - this.runStartTimeMs;

    this.copyAssets();

    const metrics = computeDashboardMetrics(this.testCases);
    const browserSummary = this.getBrowserSummary();
    const header = this.buildHeaderMetadata(durationMs, browserSummary);
    const reportData = {
      header,
      metrics,
      tests: this.testCases,
      overallStatus: result.status,
      generatedAt: new Date().toISOString(),
    };
    const reportJson = JSON.stringify(reportData, null, 2);
    const reportHtml = buildHtmlReport(header, metrics, this.testCases, reportJson);

    fs.writeFileSync(path.join(this.resolvedOutputDir, 'index.html'), reportHtml, 'utf8');
    fs.writeFileSync(path.join(this.resolvedOutputDir, 'report-data.json'), reportJson, 'utf8');
  }

  /**
   * Flattens nested Playwright steps into a single ordered list for report rendering.
   */
  private flattenSteps(steps: TestStep[]): NormalizedStep[] {
    const results: NormalizedStep[] = [];

    const walk = (sourceSteps: TestStep[]): void => {
      for (const step of sourceSteps) {
        const hasError = Boolean(step.error);
        results.push({
          title: step.title,
          durationMs: step.duration,
          status: hasError ? 'failed' : 'passed',
          errorMessage: step.error?.message,
        });

        if (step.steps?.length) {
          walk(step.steps);
        }
      }
    };

    walk(steps);
    return results;
  }

  /**
   * Normalizes Playwright attachments with safe paths and report-friendly categories.
   */
  private normalizeAttachments(result: TestResult): NormalizedAttachment[] {
    const attachments: NormalizedAttachment[] = [];

    for (const attachment of result.attachments ?? []) {
      if (!attachment.path) {
        continue;
      }

      const absoluteAttachmentPath = path.resolve(attachment.path);
      const reportRelativePath = getReportRelativePath(this.resolvedOutputDir, absoluteAttachmentPath);
      const browserPath = this.toBrowserAssetPath(reportRelativePath, absoluteAttachmentPath);

      attachments.push({
        name: attachment.name || path.basename(absoluteAttachmentPath),
        path: browserPath,
        kind: detectAttachmentKind(attachment.name || '', absoluteAttachmentPath),
      });
    }

    return attachments;
  }

  /**
   * Converts artifact paths into browser-safe href/src values.
   * Keeps report-relative paths unchanged, and converts absolute paths to file URLs.
   */
  private toBrowserAssetPath(reportRelativePath: string, absoluteAttachmentPath: string): string {
    const isAbsolutePath = path.isAbsolute(reportRelativePath);
    if (!isAbsolutePath) {
      return reportRelativePath;
    }

    const normalized = absoluteAttachmentPath.split(path.sep).join('/');
    const prefixed = normalized.startsWith('/') ? normalized : `/${normalized}`;
    return encodeURI(`file://${prefixed}`);
  }

  /**
   * Extracts stdout/stderr text logs captured by Playwright for each result.
   */
  private extractConsoleLogs(result: TestResult): string[] {
    const logs: string[] = [];

    for (const stdout of result.stdout ?? []) {
      if (typeof stdout === 'string') {
        logs.push(stdout);
      } else if (Buffer.isBuffer(stdout)) {
        logs.push(stdout.toString('utf8'));
      }
    }

    for (const stderr of result.stderr ?? []) {
      if (typeof stderr === 'string') {
        logs.push(stderr);
      } else if (Buffer.isBuffer(stderr)) {
        logs.push(stderr.toString('utf8'));
      }
    }

    return logs.map((line) => line.trim()).filter((line) => line.length > 0);
  }

  /**
   * Builds report header from env values and runtime defaults.
   */
  private buildHeaderMetadata(totalDurationMs: number, browserSummary: string): ReportHeaderMetadata {
    const executionDate = formatExecutionDate(new Date(this.runEndTimeMs || Date.now()));

    return {
      companyName: valueOrFallback(process.env.COMPANY_NAME || this.options.companyName, 'BirchStreet Systems'),
      subscriberId: valueOrFallback(process.env.SUBSCRIBER_ID || this.options.subscriberId, '641'),
      companyId: valueOrFallback(process.env.COMPANY_ID || process.env.TARGET_COMPANY_ID || this.options.companyId, '931'),
      cdNumber: valueOrFallback(process.env.CD_NUMBER || this.options.cdNumber, ''),
      buildNumber: valueOrFallback(process.env.BUILD_NUMBER || this.options.buildNumber, 'Not Provided'),
      runId: valueOrFallback(process.env.RUN_ID || this.options.runId, `RUN-${Date.now()}`),
      executionDate,
      browser: browserSummary,
      environment: valueOrFallback(process.env.TEST_ENV || process.env.ENV || this.options.environment, 'QA'),
      totalExecutionTime: formatDuration(totalDurationMs),
    };
  }

  /**
   * Copies static report assets (css/js/images) to output directory.
   */
  private copyAssets(): void {
    const targetAssetsDir = path.join(this.resolvedOutputDir, 'assets');
    const sourceCssDir = path.join(this.resolvedAssetsSourceDir, 'css');
    const sourceJsDir = path.join(this.resolvedAssetsSourceDir, 'js');
    const sourceImagesDir = path.join(this.resolvedAssetsSourceDir, 'images');

    fs.mkdirSync(path.join(targetAssetsDir, 'css'), { recursive: true });
    fs.mkdirSync(path.join(targetAssetsDir, 'js'), { recursive: true });
    fs.mkdirSync(path.join(targetAssetsDir, 'images'), { recursive: true });

    if (fs.existsSync(sourceCssDir)) {
      fs.cpSync(sourceCssDir, path.join(targetAssetsDir, 'css'), { recursive: true, force: true });
    }
    if (fs.existsSync(sourceJsDir)) {
      fs.cpSync(sourceJsDir, path.join(targetAssetsDir, 'js'), { recursive: true, force: true });
    }
    if (fs.existsSync(sourceImagesDir)) {
      fs.cpSync(sourceImagesDir, path.join(targetAssetsDir, 'images'), { recursive: true, force: true });
    }
  }

  /**
   * Attempts to read Playwright project name for browser label.
   */
  private tryGetProjectName(test: TestCase): string | undefined {
    const project = test.parent.project?.();
    return project?.name;
  }

  /**
   * Creates a concise browser summary for the run header.
   */
  private getBrowserSummary(): string {
    const browserSet = new Set(this.testCases.map((testCase) => testCase.browser));
    const browsers = Array.from(browserSet).filter((browser) => browser.trim().length > 0);
    return browsers.length > 0 ? browsers.join(', ') : 'chromium';
  }

  /**
   * Uses a richer fallback display name when test title is generic.
   */
  private resolveDisplayTestName(test: TestCase): string {
    const rawTitle = (test.title || '').trim();
    if (!this.isGenericTitle(rawTitle)) {
      return rawTitle;
    }

    const titlePath = test.titlePath().filter((part) => part && part.trim().length > 0);
    const describeParts = titlePath.filter((part) => part !== rawTitle && !part.endsWith('.spec.ts'));
    const describeName = describeParts.length > 0 ? describeParts[describeParts.length - 1] : '';
    const specName = path.parse(test.location.file).name.replace(/[_-]+/g, ' ').trim();
    const fallbackName = [describeName, specName].filter((part) => part.length > 0).join(' - ');
    return fallbackName || rawTitle || 'Unnamed Test Case';
  }

  /**
   * Detects placeholder-like titles that are not useful in reports.
   */
  private isGenericTitle(title: string): boolean {
    const normalized = title.toLowerCase();
    return normalized.length === 0 || normalized === 'test' || normalized === 'untitled' || normalized === 'smoke';
  }
}

export default CustomReporter;
