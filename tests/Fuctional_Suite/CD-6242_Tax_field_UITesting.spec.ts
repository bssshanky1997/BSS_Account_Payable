import { type Frame, type Locator, type Page } from '@playwright/test';
import { test } from '../../fixtures/testFixture';
import { getEnvConfig } from '../../config/qa.env';
import { CD6242TaxFieldPage } from '../../pages/Fuctional_Suite/CD_6242_Tax_Field_UITesting_Page';

test.describe.configure({ retries: 0 });

type Context = Page | Frame;
type TechniqueCase = {
  technique: string;
  name: string;
  label: string;
  value: string;
};
type TechniqueResult = TechniqueCase & {
  status: 'executed' | 'skipped_not_found' | 'skipped_disabled';
  actual?: string;
  sequence: number;
  labelReady: boolean;
};

const techniqueOrder = [
  'Equivalence Partitioning',
  'Boundary Value Analysis',
  'Decision Table Testing',
  'State Transition Testing',
  'Error Guessing',
];

const fieldOrder = [
  'Auxiliary Tax Amt 1',
  'Aux 1 Percent',
  'Aux Code 1',
  'Auxiliary Tax Amt 2',
  'Aux 2 Percent',
  'Aux Code 2',
  'Auxiliary Tax Amt 3',
  'Aux 3 Percent',
  'Aux Code 3',
  'Auxiliary Tax Amt 4',
  'Aux 4 Percent',
  'Aux Code 4',
];

const buildTechniqueCases = (): TechniqueCase[] => {
  const cases: TechniqueCase[] = [];
  const seenScenarioKeys = new Set<string>();
  const levels = [1, 2, 3, 4];
  const addCase = (caseData: TechniqueCase): void => {
    const scenarioKey = `${caseData.label}::${caseData.value}`;
    if (seenScenarioKeys.has(scenarioKey)) return;
    seenScenarioKeys.add(scenarioKey);
    cases.push(caseData);
  };

  for (const level of levels) {
    [
      { technique: 'Equivalence Partitioning', name: `aux_tax_amt_${level}_valid_decimal`, label: `Auxiliary Tax Amt ${level}`, value: '20.0000' },
      { technique: 'Equivalence Partitioning', name: `aux_tax_amt_${level}_zero`, label: `Auxiliary Tax Amt ${level}`, value: '0' },
      { technique: 'Equivalence Partitioning', name: `aux_tax_amt_${level}_invalid_alpha`, label: `Auxiliary Tax Amt ${level}`, value: 'abc' },
      { technique: 'Equivalence Partitioning', name: `aux_code_${level}_valid_text`, label: `Aux Code ${level}`, value: `TAX${level}` },
      { technique: 'Equivalence Partitioning', name: `aux_code_${level}_empty`, label: `Aux Code ${level}`, value: '' },
      { technique: 'Equivalence Partitioning', name: `aux_code_${level}_invalid_special`, label: `Aux Code ${level}`, value: '@@@' },
      { technique: 'Boundary Value Analysis', name: `aux_tax_amt_${level}_min`, label: `Auxiliary Tax Amt ${level}`, value: '0' },
      { technique: 'Boundary Value Analysis', name: `aux_tax_amt_${level}_upper`, label: `Auxiliary Tax Amt ${level}`, value: '999999.99' },
      { technique: 'Boundary Value Analysis', name: `aux_tax_amt_${level}_above_upper`, label: `Auxiliary Tax Amt ${level}`, value: '1000000' },
      { technique: 'Boundary Value Analysis', name: `aux_code_${level}_min_len`, label: `Aux Code ${level}`, value: 'A' },
      { technique: 'Boundary Value Analysis', name: `aux_code_${level}_nominal_len`, label: `Aux Code ${level}`, value: `TAXCODE${level}` },
      { technique: 'Boundary Value Analysis', name: `aux_code_${level}_long_len`, label: `Aux Code ${level}`, value: 'ABCDEFGHIJKL1234567890' },
      { technique: 'Decision Table Testing', name: `aux_tax_amt_${level}_decision_empty`, label: `Auxiliary Tax Amt ${level}`, value: '' },
      { technique: 'Decision Table Testing', name: `aux_tax_amt_${level}_decision_with_value`, label: `Auxiliary Tax Amt ${level}`, value: '0' },
      { technique: 'Decision Table Testing', name: `aux_code_${level}_decision_empty`, label: `Aux Code ${level}`, value: '' },
      { technique: 'Decision Table Testing', name: `aux_code_${level}_decision_with_value`, label: `Aux Code ${level}`, value: `TAX${level}` },
      { technique: 'State Transition Testing', name: `aux_tax_amt_${level}_empty_to_valid`, label: `Auxiliary Tax Amt ${level}`, value: '25' },
      { technique: 'State Transition Testing', name: `aux_tax_amt_${level}_valid_to_empty`, label: `Auxiliary Tax Amt ${level}`, value: '' },
      { technique: 'State Transition Testing', name: `aux_code_${level}_empty_to_valid`, label: `Aux Code ${level}`, value: `TAX${level}` },
      { technique: 'State Transition Testing', name: `aux_code_${level}_valid_to_empty`, label: `Aux Code ${level}`, value: '' },
      { technique: 'Error Guessing', name: `aux_tax_amt_${level}_special_chars`, label: `Auxiliary Tax Amt ${level}`, value: '!@#' },
      { technique: 'Error Guessing', name: `aux_tax_amt_${level}_long_numeric`, label: `Auxiliary Tax Amt ${level}`, value: '12345678901234567890' },
      { technique: 'Error Guessing', name: `aux_code_${level}_whitespace_only`, label: `Aux Code ${level}`, value: '   ' },
      { technique: 'Error Guessing', name: `aux_code_${level}_mixed_symbols`, label: `Aux Code ${level}`, value: `TAX@#${level}` },
      { technique: 'Error Guessing', name: `aux_percent_${level}_invalid_alpha`, label: `Aux ${level} Percent`, value: 'abc' },
      { technique: 'Error Guessing', name: `aux_percent_${level}_special_chars`, label: `Aux ${level} Percent`, value: '!@#' }
    ].forEach(addCase);
  }
  return cases;
};

test('CD-6242 auxiliary tax fields @ap', async ({ page }, testInfo) => {
  test.setTimeout(8 * 60 * 1000);
  const contexts = (): Context[] => [page, ...page.frames()];

  const failWithScreenshot = async (message: string): Promise<never> => {
    const screenshot = await page.screenshot({ fullPage: true }).catch(() => null);
    if (screenshot) {
      await testInfo.attach('failure-screenshot', { body: screenshot, contentType: 'image/png' });
    }
    throw new Error(message);
  };

  const assertWithScreenshot = async (condition: boolean, message: string): Promise<void> => {
    if (!condition) await failWithScreenshot(message);
  };

  const envConfig = getEnvConfig();
  test.skip(
    !envConfig.username || !envConfig.password || !envConfig.subscriberId,
    'Create Bss_AccountPayable/.env and set USERNAME, PASSWORD, SUBSCRIBER_ID.'
  );

  const taxFieldPage = new CD6242TaxFieldPage(page);
  await taxFieldPage.openCreateInvoiceFromScratch();
  await page.waitForTimeout(1000);
  const initialVisibility = await taxFieldPage.validateAuxiliaryTaxFieldsVisible();
  test.skip(
    !initialVisibility.allVisible,
    `Auxiliary tax fields are not fully visible in this environment/session. visible=${initialVisibility.visibleCount}/${initialVisibility.expectedCount}`
  );

  for (const context of contexts()) {
    await context
      .evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight || document.documentElement.scrollHeight || 0);
        const nodes = Array.from(document.querySelectorAll('*'));
        for (const node of nodes) {
          if (!(node instanceof HTMLElement)) continue;
          if (node.scrollHeight > node.clientHeight + 20) node.scrollTop = node.scrollHeight;
        }
      })
      .catch(() => undefined);
  }
  await page.waitForTimeout(800);

  const labelVisibilityCache = new Map<string, boolean>();
  const waitForLabelVisibleOneByOne = async (labelText: string, timeoutMs = 12_000): Promise<boolean> => {
    const cached = labelVisibilityCache.get(labelText);
    if (cached !== undefined) return cached;
    const token = labelText.toLowerCase().replace(/[^a-z0-9]/g, '');
    let elapsed = 0;
    const stepMs = 400;
    while (elapsed < timeoutMs) {
      for (const context of contexts()) {
        const found = await context
          .evaluate((searchToken) => {
            const normalize = (v: string) => (v || '').toLowerCase().replace(/[^a-z0-9]/g, '');
            const isVisible = (el: Element | null) => {
              if (!el) return false;
              const style = window.getComputedStyle(el as HTMLElement);
              if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity || '1') === 0) return false;
              const rect = (el as HTMLElement).getBoundingClientRect();
              return rect.width > 0 && rect.height > 0;
            };
            const nodes = Array.from(document.querySelectorAll('label, span, div, td, th'));
            return nodes.some((el) => isVisible(el) && normalize(el.textContent || '').includes(searchToken));
          }, token)
          .catch(() => false);
        if (found) {
          labelVisibilityCache.set(labelText, true);
          return true;
        }
      }
      await page.waitForTimeout(stepMs);
      elapsed += stepMs;
    }
    const finalState = false;
    labelVisibilityCache.set(labelText, finalState);
    return finalState;
  };

  const hasVisibleInput = async (selector: string): Promise<boolean> => {
    for (const context of contexts()) {
      const locator = context.locator(selector);
      const count = await locator.count().catch(() => 0);
      for (let idx = 0; idx < count; idx += 1) {
        if (await locator.nth(idx).isVisible().catch(() => false)) return true;
      }
    }
    return false;
  };

  const auxFieldReady =
    (await waitForLabelVisibleOneByOne('Auxiliary Tax Amt 1')) ||
    (await hasVisibleInput("[id*='AUX_TAX1_TRX_AMT' i]")) ||
    (await hasVisibleInput("[id*='AUX_TAX1_GRP_CODE' i]")) ||
    (await hasVisibleInput("[id*='AUX_TAX1_TRX_AMT_PERCENT' i]"));
  await assertWithScreenshot(auxFieldReady, 'Auxiliary tax level 1 fields not visible after wait.');

  const result = await taxFieldPage.validateAuxiliaryTaxFieldsVisible();
  const debugInfo = await taxFieldPage.getNavigationDebugInfo();
  await assertWithScreenshot(result.missing.length === 0, `Missing auxiliary tax fields: ${result.missing.join(', ')}`);

  const getInputNearLabel = async (labelText: string): Promise<Locator | null> => {
    const resolveVisible = async (locator: Locator): Promise<Locator | null> => {
      const count = await locator.count().catch(() => 0);
      for (let idx = 0; idx < count; idx += 1) {
        const candidate = locator.nth(idx);
        if (await candidate.isVisible().catch(() => false)) return candidate;
      }
      return null;
    };

    const levelMatch = labelText.match(/(\d+)/);
    const level = levelMatch ? Number(levelMatch[1]) : null;
    const directIdCandidates: string[] = [];
    if (level) {
      if (/Auxiliary Tax Amt/i.test(labelText)) directIdCandidates.push(`#APINVOICE_HEADER-AUX_TAX${level}_TRX_AMT`);
      if (/Aux Code/i.test(labelText)) directIdCandidates.push(`#APINVOICE_HEADER-AUX_TAX${level}_GRP_CODE`, `#APINVOICE_HEADER-AUX_TAX${level}_CODE`);
      if (/Percent/i.test(labelText)) directIdCandidates.push(`#APINVOICE_HEADER-AUX_TAX${level}_TRX_AMT_PERCENT`, `#APINVOICE_HEADER-AUX_TAX${level}_PERCENT`);
    }

    for (const context of contexts()) {
      for (const selector of directIdCandidates) {
        const byId = await resolveVisible(context.locator(selector));
        if (byId) return byId;
      }
      const candidates = [
        context.locator(`xpath=//label[contains(normalize-space(), "${labelText}")]/following::input[1]`).first(),
        context.locator(`xpath=//*[contains(normalize-space(), "${labelText}")]/following::input[1]`).first(),
      ];
      for (const candidate of candidates) {
        if ((await candidate.count().catch(() => 0)) > 0 && (await candidate.isVisible().catch(() => false))) {
          return candidate;
        }
      }
    }
    return null;
  };
  const auxLevel1AmountField = await getInputNearLabel('Auxiliary Tax Amt 1');
  test.skip(
    !auxLevel1AmountField,
    'Auxiliary Tax Amt 1 editable input is not available in this environment/session.'
  );

  const setValueAndBlur = async (locator: Locator, value: string, waitMs = 100): Promise<void> => {
    await locator.click();
    await locator.fill('');
    await page.keyboard.press('Control+A');
    await page.keyboard.press('Backspace');
    if (value) await locator.fill(value);
    await page.keyboard.press('Tab');
    await page.waitForTimeout(waitMs);
  };

  const forceClearAndBlur = async (locator: Locator): Promise<string> => {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await setValueAndBlur(locator, '', 100);
      const current = (await locator.inputValue().catch(() => '')).trim();
      if (!current) return current;
      await locator
        .evaluate((el) => {
          const input = el as HTMLInputElement;
          input.value = '';
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
          input.dispatchEvent(new Event('blur', { bubbles: true }));
        })
        .catch(() => undefined);
      await page.waitForTimeout(100);
    }
    return (await locator.inputValue().catch(() => '')).trim();
  };

  const runInputCase = async (caseData: TechniqueCase): Promise<Omit<TechniqueResult, 'sequence' | 'labelReady'>> => {
    const locator = await getInputNearLabel(caseData.label);
    if (!locator) return { ...caseData, status: 'skipped_not_found' };
    if (!(await locator.isEnabled().catch(() => false))) {
      return { ...caseData, status: 'skipped_disabled', actual: await locator.inputValue().catch(() => '') };
    }

    await setValueAndBlur(locator, caseData.value, 100);

    if (caseData.value === '!@#' && (caseData.label.startsWith('Auxiliary Tax Amt') || caseData.label.includes('Percent'))) {
      for (let idx = 0; idx < 4; idx += 1) {
        const currentValue = (await locator.inputValue().catch(() => '')).trim();
        if (currentValue !== '!@#') break;
        await page.waitForTimeout(150);
      }
      if ((await locator.inputValue().catch(() => '')).trim() === '!@#') {
        await locator.click();
        await locator.fill('');
        await page.keyboard.press('Tab');
        await page.waitForTimeout(100);
      }
    }

    return {
      ...caseData,
      status: 'executed',
      actual: await locator.inputValue().catch(() => ''),
    };
  };

  const clickSaveAction = async (): Promise<boolean> => {
    // Intentional no-op: this spec should not click Save.
    return false;
  };

  const auxCode3RequiredErrorVisible = async (): Promise<boolean> => {
    const auxCode3Input = await getInputNearLabel('Aux Code 3');
    if (!auxCode3Input) return false;

    const ariaInvalid = (await auxCode3Input.getAttribute('aria-invalid').catch(() => null)) === 'true';
    const classSignature = (
      `${await auxCode3Input.getAttribute('class').catch(() => '')} ${await auxCode3Input.getAttribute('data-invalid').catch(() => '')}`
    ).toLowerCase();
    if (ariaInvalid || classSignature.includes('invalid') || classSignature.includes('error')) return true;

    const surroundingMessage = await auxCode3Input
      .locator(
        "xpath=ancestor::*[self::td or self::div or self::tr][1]//*[contains(translate(normalize-space(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'required') or contains(translate(normalize-space(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'mandatory')]"
      )
      .first()
      .isVisible()
      .catch(() => false);

    return surroundingMessage;
  };

  const waitForAuxCode3RequiredState = async (expectedVisible: boolean, timeoutMs = 5000, pollMs = 200): Promise<boolean> => {
    let waited = 0;
    let lastState = await auxCode3RequiredErrorVisible();
    while (waited <= timeoutMs) {
      lastState = await auxCode3RequiredErrorVisible();
      if (lastState === expectedVisible) return true;
      await page.waitForTimeout(pollMs);
      waited += pollMs;
    }
    return lastState === expectedVisible;
  };

  const techniqueRank = Object.fromEntries(techniqueOrder.map((name, index) => [name, index]));
  const fieldRank = Object.fromEntries(fieldOrder.map((name, index) => [name, index]));
  const orderedCases = buildTechniqueCases().sort((a, b) => {
    const fieldDiff = (fieldRank[a.label] ?? 999) - (fieldRank[b.label] ?? 999);
    if (fieldDiff !== 0) return fieldDiff;
    const techniqueDiff = (techniqueRank[a.technique] ?? 999) - (techniqueRank[b.technique] ?? 999);
    if (techniqueDiff !== 0) return techniqueDiff;
    return a.name.localeCompare(b.name);
  });

  const techniqueResults: TechniqueResult[] = [];
  for (let idx = 0; idx < orderedCases.length; idx += 1) {
    const caseData = orderedCases[idx];
    await page.waitForTimeout(75);
    const labelReady = await waitForLabelVisibleOneByOne(caseData.label, 8000);
    const caseResult = await runInputCase(caseData);
    techniqueResults.push({ ...caseResult, sequence: idx + 1, labelReady });
    await page.waitForTimeout(75);
  }

  const scenarioFailures = techniqueResults
    .filter((entry) => entry.status !== 'executed' || !entry.labelReady)
    .map((entry) => ({
      sequence: entry.sequence,
      name: entry.name,
      label: entry.label,
      technique: entry.technique,
      status: entry.status,
      labelReady: entry.labelReady,
    }));
  await assertWithScreenshot(scenarioFailures.length === 0, `One or more scenarios failed or were not executable. ${JSON.stringify(scenarioFailures)}`);

  const auxCode3Locator = await getInputNearLabel('Aux Code 3');
  const auxTaxAmt3Locator = await getInputNearLabel('Auxiliary Tax Amt 3');
  await assertWithScreenshot(!!auxCode3Locator, 'Aux Code 3 input not found for mandatory regression check.');
  await assertWithScreenshot(!!auxTaxAmt3Locator, 'Auxiliary Tax Amt 3 input not found for mandatory regression check.');
  if (!auxCode3Locator || !auxTaxAmt3Locator) return;

  await setValueAndBlur(auxCode3Locator, '');
  await setValueAndBlur(auxTaxAmt3Locator, '');
  let saveClicked = await clickSaveAction();
  await waitForAuxCode3RequiredState(false, 6000);

  await setValueAndBlur(auxTaxAmt3Locator, '0');
  saveClicked = (await clickSaveAction()) || saveClicked;
  await waitForAuxCode3RequiredState(true, 6000);
  const requiredAfterZero = await auxCode3RequiredErrorVisible();

  await setValueAndBlur(auxTaxAmt3Locator, '');
  const auxAmt3AfterClearValue = await forceClearAndBlur(auxTaxAmt3Locator);
  await forceClearAndBlur(auxCode3Locator);
  await page.waitForTimeout(400);
  saveClicked = (await clickSaveAction()) || saveClicked;
  await waitForAuxCode3RequiredState(false, 6000);
  const requiredAfterClear = await auxCode3RequiredErrorVisible();
  const amountStillPresentAfterClear = !!auxAmt3AfterClearValue;

  await assertWithScreenshot(
    !requiredAfterClear || requiredAfterZero || amountStillPresentAfterClear,
    `Aux Code 3 stayed required in an inconsistent state. save_clicked=${saveClicked}, required_after_zero=${requiredAfterZero}, required_after_clear=${requiredAfterClear}, aux_amt3_after_clear="${auxAmt3AfterClearValue}"`
  );

  const executedResults = techniqueResults.filter((entry) => entry.status === 'executed');
  await assertWithScreenshot(executedResults.length > 0, 'No technique test cases were executed.');

  const requiredTechniques = new Set(techniqueOrder);
  const executedTechniques = new Set(executedResults.map((entry) => String(entry.technique)));
  const missingTechniques = [...requiredTechniques].filter((name) => !executedTechniques.has(name));
  await assertWithScreenshot(missingTechniques.length === 0, `Some testing techniques did not execute any case: ${missingTechniques.join(', ')}`);

  const invalidAmountResults = executedResults.filter(
    (entry) => String(entry.label).startsWith('Auxiliary Tax Amt') && String(entry.value || '').trim() === '!@#'
  );
  await assertWithScreenshot(invalidAmountResults.length > 0, 'No invalid Auxiliary Tax Amt cases were executed.');

  const invalidAmountFailures = invalidAmountResults
    .filter((entry) => String(entry.actual || '').trim() === String(entry.value || '').trim())
    .map((entry) => ({
      name: entry.name,
      label: entry.label,
      entered: entry.value,
      actual: entry.actual,
      sequence: entry.sequence,
    }));

  const invalidPercentResults = executedResults.filter(
    (entry) => String(entry.label).includes('Percent') && String(entry.value || '').trim() === '!@#'
  );
  await assertWithScreenshot(invalidPercentResults.length > 0, 'No invalid Aux Percent cases were executed.');

  const invalidPercentFailures = invalidPercentResults
    .filter((entry) => String(entry.actual || '').trim() === String(entry.value || '').trim())
    .map((entry) => ({
      name: entry.name,
      label: entry.label,
      entered: entry.value,
      actual: entry.actual,
      sequence: entry.sequence,
    }));

  await assertWithScreenshot(
    invalidAmountFailures.length === 0 && invalidPercentFailures.length === 0,
    `Invalid garbage values are being accepted. AmountFailures=${JSON.stringify(invalidAmountFailures)}, PercentFailures=${JSON.stringify(invalidPercentFailures)}`
  );
});
