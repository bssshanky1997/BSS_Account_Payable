import { EnterpriseStatus, NormalizedTestCase } from './ReportUtils';

/**
 * Dashboard KPI payload consumed by the HTML builder.
 */
export interface DashboardMetrics {
  totalTests: number;
  passed: number;
  failed: number;
  blocked: number;
  skipped: number;
  passPercentage: number;
}

/**
 * Generic status counter utility to keep metric creation concise.
 */
function countByStatus(testCases: NormalizedTestCase[], status: EnterpriseStatus): number {
  return testCases.filter((testCase) => testCase.status === status).length;
}

/**
 * Computes complete dashboard metrics for a report run.
 */
export function computeDashboardMetrics(testCases: NormalizedTestCase[]): DashboardMetrics {
  const totalTests = testCases.length;
  const passed = countByStatus(testCases, 'passed');
  const failed = countByStatus(testCases, 'failed');
  const blocked = countByStatus(testCases, 'blocked');
  const skipped = countByStatus(testCases, 'skipped');

  const passPercentage = totalTests > 0 ? Number(((passed / totalTests) * 100).toFixed(2)) : 0;

  return {
    totalTests,
    passed,
    failed,
    blocked,
    skipped,
    passPercentage,
  };
}
