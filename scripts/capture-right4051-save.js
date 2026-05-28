const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const TARGET_RIGHT_ID = process.env.RIGHT_ID || '4051';
const TARGET_SCREEN_ID = process.env.RIGHTS_SCREEN_ID || '10523';
const STORAGE_STATE_PATH = process.env.RIGHTS_STORAGE_STATE || 'playwright/.auth/user.json';
const CAPTURE_TIMEOUT_MS = Number(process.env.CAPTURE_TIMEOUT_MS || '240000');
const OUTPUT_DIR = process.env.RIGHTS_CAPTURE_OUTPUT_DIR || 'test-results/right-capture';

const ensureDir = (dirPath) => {
  fs.mkdirSync(dirPath, { recursive: true });
};

const nowStamp = () => new Date().toISOString().replace(/[:.]/g, '-');

const safeJson = (value) => {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

const decodeXmlField = (raw) => {
  if (!raw) return '';
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
};

const parseFormPostData = (postData) => {
  const params = new URLSearchParams(postData || '');
  return {
    doctype: params.get('doctype') || '',
    action: params.get('action') || '',
    state: params.get('state') || '',
    documentNumber: params.get('documentNumber') || '',
    csrf: params.get('csrf_xyz123') || '',
    xmlRaw: params.get('xml') || '',
    xmlDecoded: decodeXmlField(params.get('xml') || ''),
    rowInEditing: params.get('rowInEditing') || '',
    columnInEditing: params.get('columnInEditing') || '',
    xmlCompressed: params.get('xmlCompressed') || '',
    xmlOriginalSize: params.get('xmlOriginalSize') || '',
    allFields: [...params.entries()],
  };
};

const isSaveCandidate = (parsed) => {
  // Ignore most validation-only save cycles when possible.
  if (parsed.action === 'CV' && !parsed.xmlDecoded.includes(TARGET_RIGHT_ID)) return false;
  return (
    parsed.xmlDecoded.includes(TARGET_RIGHT_ID) ||
    parsed.xmlDecoded.includes('SMPOSITION_RIGHT_DETAIL') ||
    parsed.xmlDecoded.includes('RIGHT_ID')
  );
};

async function main() {
  const absOutputDir = path.resolve(process.cwd(), OUTPUT_DIR);
  ensureDir(absOutputDir);

  const runId = nowStamp();
  const runDir = path.join(absOutputDir, `capture-${runId}`);
  ensureDir(runDir);

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    storageState: STORAGE_STATE_PATH,
    ignoreHTTPSErrors: true,
    viewport: null,
  });
  const page = await context.newPage();

  const captured = [];
  const saveRequests = [];

  page.on('request', (request) => {
    if (request.method() !== 'POST') return;
    if (!request.url().includes('/DocumentSave.jsp')) return;

    const postData = request.postData() || '';
    const parsed = parseFormPostData(postData);

    const payload = {
      timestamp: new Date().toISOString(),
      url: request.url(),
      method: request.method(),
      headers: request.headers(),
      parsed,
      rawPostData: postData,
    };

    saveRequests.push(payload);
    if (isSaveCandidate(parsed)) captured.push(payload);
  });

  const targetUrl = `https://appqa.birchstreet.co/j4/agscreen.jsp?screenid=${TARGET_SCREEN_ID}`;
  await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });

  console.log('--------------------------------------------');
  console.log('Rights Save Capture Started');
  console.log(`Screen ID: ${TARGET_SCREEN_ID}`);
  console.log(`Target Right ID: ${TARGET_RIGHT_ID}`);
  console.log(`Capture timeout: ${CAPTURE_TIMEOUT_MS}ms`);
  console.log('');
  console.log('Manual steps:');
  console.log('1) Open the row/user/position where Right 4051 is shown');
  console.log('2) Toggle Right 4051 ON or OFF');
  console.log('3) Click Save');
  console.log('');
  console.log('Capture will auto-finish after timeout.');
  console.log('--------------------------------------------');

  await page.waitForTimeout(CAPTURE_TIMEOUT_MS);
  await browser.close();

  fs.writeFileSync(path.join(runDir, 'all-document-save-requests.json'), safeJson(saveRequests));
  fs.writeFileSync(path.join(runDir, 'candidate-right-save-requests.json'), safeJson(captured));

  if (captured.length > 0) {
    const best = captured[captured.length - 1];
    fs.writeFileSync(path.join(runDir, 'latest-candidate-xml-decoded.xml'), best.parsed.xmlDecoded || '');

    const summary = {
      runDir,
      capturedCandidates: captured.length,
      selected: {
        action: best.parsed.action,
        doctype: best.parsed.doctype,
        state: best.parsed.state,
        documentNumber: best.parsed.documentNumber,
        url: best.url,
      },
    };
    fs.writeFileSync(path.join(runDir, 'summary.json'), safeJson(summary));

    console.log('Capture completed with candidates.');
    console.log(`Output: ${runDir}`);
    console.log(`Selected action=${best.parsed.action}, doctype=${best.parsed.doctype}`);
  } else {
    const summary = {
      runDir,
      capturedCandidates: 0,
      note: 'No candidate save payload matched right-id filters. Check all-document-save-requests.json.',
    };
    fs.writeFileSync(path.join(runDir, 'summary.json'), safeJson(summary));
    console.log('No candidate right-save payload found.');
    console.log(`Inspect output: ${runDir}`);
  }
}

main().catch((error) => {
  console.error('Capture script failed:', error);
  process.exitCode = 1;
});
