import fs from 'fs';
import path from 'path';

const baseScreenshotDir = path.resolve(__dirname, '..', 'reports', 'screenshot');

export function sanitizeForPath(value: string): string {
  return value
    .replace(/[^a-zA-Z0-9-_ ]+/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function ensureDirExists(dirPath: string): void {
  fs.mkdirSync(dirPath, { recursive: true });
}

export function getScreenshotDirForTest(testTitle: string): string {
  ensureDirExists(baseScreenshotDir);
  const sanitizedTitle = testTitle
    .replace(/[^a-zA-Z0-9-_. ]+/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '') || 'unnamed_test';
  const testDir = path.join(baseScreenshotDir, sanitizedTitle);
  ensureDirExists(testDir);
  return testDir;
}

export function getScreenshotPathForTest(testTitle: string, fileName: string): string {
  const safeName = sanitizeForPath(fileName) || 'screenshot';
  return path.join(getScreenshotDirForTest(testTitle), `${safeName}.png`);
}

export function getTestCaseFolderName(testTitle: string, testFilePath?: string): string {
  if (testFilePath) {
    const fileName = path.basename(testFilePath);
    const withoutLastExtension = fileName.replace(/\.[^.]+$/, '');
    const safeFolderName = withoutLastExtension
      .replace(/[^a-zA-Z0-9-_. ]+/g, '_')
      .replace(/\s+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '');
    return safeFolderName || 'unnamed_test';
  }

  return sanitizeForPath(testTitle) || 'unnamed_test';
}
