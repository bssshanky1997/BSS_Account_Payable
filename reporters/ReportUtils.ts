import path from 'path';

/**
 * Reporter-level run metadata shown in the header section.
 */
export interface ReportHeaderMetadata {
  companyName: string;
  subscriberId: string;
  companyId: string;
  cdNumber: string;
  buildNumber: string;
  runId: string;
  executionDate: string;
  browser: string;
  environment: string;
  totalExecutionTime: string;
}

/**
 * Supported test statuses in the custom report.
 */
export type EnterpriseStatus = 'passed' | 'failed' | 'blocked' | 'skipped';

/**
 * Normalized test step model for dashboard/details rendering.
 */
export interface NormalizedStep {
  title: string;
  durationMs: number;
  status: EnterpriseStatus;
  errorMessage?: string;
}

/**
 * Supported attachment types rendered in the details panel.
 */
export type AttachmentKind =
  | 'screenshot'
  | 'video'
  | 'trace'
  | 'api-log'
  | 'network-log'
  | 'console-log'
  | 'error-log'
  | 'other';

/**
 * Normalized attachment model used by HTML builder and client scripts.
 */
export interface NormalizedAttachment {
  name: string;
  path: string;
  kind: AttachmentKind;
}

/**
 * Normalized testcase model used end-to-end by the custom reporter.
 */
export interface NormalizedTestCase {
  id: string;
  tcId: string;
  testName: string;
  status: EnterpriseStatus;
  executionTimeMs: number;
  description: string;
  preconditions: string;
  testData: string;
  testSteps: NormalizedStep[];
  expectedResult: string;
  actualResult: string;
  errorMessage: string;
  stackTrace: string;
  attachments: NormalizedAttachment[];
  consoleLogs: string[];
  suitePath: string[];
  browser: string;
  environment: string;
}

/**
 * Returns a string fallback if the source value is empty.
 */
export function valueOrFallback(value: string | undefined, fallback: string): string {
  const normalized = (value ?? '').trim();
  return normalized.length > 0 ? normalized : fallback;
}

/**
 * Converts milliseconds to a user-friendly duration label.
 */
export function formatDuration(durationMs: number): string {
  if (!Number.isFinite(durationMs) || durationMs < 0) {
    return '0s';
  }

  const totalSeconds = Math.floor(durationMs / 1000);
  const milliseconds = durationMs % 1000;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }

  if (seconds > 0) {
    return `${seconds}s`;
  }

  return `${milliseconds}ms`;
}

/**
 * Converts date objects to a stable display value.
 */
export function formatExecutionDate(date: Date): string {
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
}

/**
 * Returns a deterministic id from any input text.
 */
export function createStableId(input: string): string {
  const safe = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return safe.length > 0 ? safe : 'test-case';
}

/**
 * Escapes user-facing values before injecting into HTML.
 */
export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Converts absolute artifact paths to report-relative paths when possible.
 */
export function getReportRelativePath(outputRoot: string, candidatePath: string): string {
  if (!candidatePath) {
    return candidatePath;
  }

  const normalizedRoot = path.resolve(outputRoot);
  const normalizedCandidate = path.resolve(candidatePath);

  if (!normalizedCandidate.startsWith(normalizedRoot)) {
    return candidatePath;
  }

  const relative = path.relative(normalizedRoot, normalizedCandidate);
  return relative.split(path.sep).join('/');
}

/**
 * Heuristically classifies attachment types by name/path.
 */
export function detectAttachmentKind(name: string, attachmentPath: string): AttachmentKind {
  const combined = `${name} ${attachmentPath}`.toLowerCase();

  if (combined.includes('trace.zip') || combined.includes('trace')) {
    return 'trace';
  }
  if (combined.includes('.webm') || combined.includes('video')) {
    return 'video';
  }
  if (combined.includes('.png') || combined.includes('.jpg') || combined.includes('.jpeg') || combined.includes('screenshot')) {
    return 'screenshot';
  }
  if (combined.includes('api') && (combined.includes('.log') || combined.includes('.txt') || combined.includes('.json'))) {
    return 'api-log';
  }
  if (combined.includes('network') || combined.includes('.har')) {
    return 'network-log';
  }
  if (combined.includes('console') || combined.includes('stdout')) {
    return 'console-log';
  }
  if (combined.includes('error') || combined.includes('stack')) {
    return 'error-log';
  }

  return 'other';
}

/**
 * Maps Playwright status into custom enterprise status.
 */
export function normalizeStatus(
  playwrightStatus: string,
  annotations: Array<{ type: string; description?: string }>,
  errorMessage: string
): EnterpriseStatus {
  const normalizedStatus = playwrightStatus.toLowerCase();
  const isBlockedByAnnotation = annotations.some((annotation) => annotation.type.toLowerCase().includes('block'));
  const isBlockedByError = errorMessage.toLowerCase().includes('blocked');

  if (normalizedStatus === 'passed') {
    return 'passed';
  }
  if (normalizedStatus === 'failed' || normalizedStatus === 'timedout' || normalizedStatus === 'interrupted') {
    return 'failed';
  }
  if (isBlockedByAnnotation || isBlockedByError) {
    return 'blocked';
  }
  return 'skipped';
}

/**
 * Derives a TC ID from test title conventions if available.
 */
export function extractTcId(testName: string): string {
  const patterns = [
    /\b(TC[-_\s]?\d+)\b/i,
    /\b(CD[-_\s]?\d{2,}[-_\s]?[A-Z]{2,}[-_\s]?\d+)\b/i,
    /\b([A-Z]{2,}[-_]\d{2,}[-_][A-Z]{2,}[-_]\d+)\b/i,
  ];

  for (const pattern of patterns) {
    const match = testName.match(pattern);
    if (match?.[1]) {
      return match[1].replace(/\s+/g, '-').toUpperCase();
    }
  }

  return 'Not Provided';
}

/**
 * Extracts expected/actual style text from assertion messages when present.
 */
export function extractExpectedAndActual(errorMessage: string): { expected: string; actual: string } {
  if (!errorMessage.trim()) {
    return {
      expected: 'Not Provided',
      actual: 'Not Provided',
    };
  }

  const expectedMatch = errorMessage.match(/Expected:\s*(.+)/i);
  const actualMatch = errorMessage.match(/Received:\s*(.+)/i);

  return {
    expected: expectedMatch?.[1]?.trim() || 'Not Provided',
    actual: actualMatch?.[1]?.trim() || 'Not Provided',
  };
}

/**
 * Parses description and documentation blocks from title/step text.
 */
export function deriveNarrativeText(testName: string, steps: NormalizedStep[]): {
  description: string;
  preconditions: string;
  testData: string;
  expectedResult: string;
} {
  const firstStep = steps.length > 0 ? steps[0].title : '';
  const description = valueOrFallback(testName, 'Not Provided');
  const preconditions = firstStep ? `Application is accessible before executing "${firstStep}".` : 'Not Provided';
  const testData = 'Not Provided';
  const expectedResult = steps.length > 0 ? 'All listed steps complete successfully.' : 'Not Provided';

  return {
    description,
    preconditions,
    testData,
    expectedResult,
  };
}
