const fs = require('fs/promises');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const TARGET_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.json',
  '.md',
  '.yml',
  '.yaml',
  '.env',
]);
const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  'reports',
  'Reports',
  'playwright-report',
  'test-results',
  'playwright',
]);

function hasUtf16LeBom(buffer) {
  return buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe;
}

function hasUtf16BeBom(buffer) {
  return buffer.length >= 2 && buffer[0] === 0xfe && buffer[1] === 0xff;
}

function hasLikelyUtf16Nuls(buffer) {
  if (buffer.length < 4) return false;
  let nulCount = 0;
  for (let i = 0; i < buffer.length; i += 1) {
    if (buffer[i] === 0x00) nulCount += 1;
  }
  return nulCount / buffer.length > 0.2;
}

function decodeUtf16(buffer) {
  if (hasUtf16LeBom(buffer)) {
    return buffer.slice(2).toString('utf16le');
  }
  if (hasUtf16BeBom(buffer)) {
    const swapped = Buffer.allocUnsafe(buffer.length - 2);
    for (let i = 2; i < buffer.length; i += 2) {
      swapped[i - 2] = buffer[i + 1] ?? 0;
      swapped[i - 1] = buffer[i];
    }
    return swapped.toString('utf16le');
  }
  return buffer.toString('utf16le');
}

async function walkFiles(dir, collector) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const absPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      await walkFiles(absPath, collector);
      continue;
    }

    const ext = path.extname(entry.name).toLowerCase();
    if (!TARGET_EXTENSIONS.has(ext) && entry.name !== '.env') continue;
    collector.push(absPath);
  }
}

async function ensureUtf8() {
  const files = [];
  await walkFiles(ROOT_DIR, files);

  let convertedCount = 0;
  for (const filePath of files) {
    const bytes = await fs.readFile(filePath);
    const isUtf16 = hasUtf16LeBom(bytes) || hasUtf16BeBom(bytes) || hasLikelyUtf16Nuls(bytes);
    if (!isUtf16) continue;

    const text = decodeUtf16(bytes);
    await fs.writeFile(filePath, text, { encoding: 'utf8' });
    convertedCount += 1;
  }

  if (convertedCount > 0) {
    console.log(`[ensure-utf8] Converted ${convertedCount} file(s) to UTF-8.`);
  } else {
    console.log('[ensure-utf8] All checked files already UTF-8.');
  }
}

ensureUtf8().catch((error) => {
  console.error('[ensure-utf8] Failed:', error);
  process.exit(1);
});
