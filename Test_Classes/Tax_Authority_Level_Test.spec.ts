import { type Page, type TestInfo } from '@playwright/test';
import { test } from '../fixtures/testFixture';
import { APHomePage } from '@poms/AP_Home_Page';
import { SmartAPListPage } from '@poms/SmartAP_List_Page';
import { SmartApDetailPage } from '@poms/SmartAp_Detail_Page';
import { TaxAuthorityLevelPage } from '@poms/Tax_Authority_Level_Page';
import { getScreenshotPathForTest, getTestCaseFolderName, sanitizeForPath } from '../utils/screenshotPath';

test.describe('Tax Authority Level', () => {
  let apHomePage: APHomePage;
  let smartAPListPage: SmartAPListPage;
  let smartApDetailPage: SmartApDetailPage;
  let taxAuthorityLevelPage: TaxAuthorityLevelPage;
  let currentPage: Page;
  let currentTestInfo: TestInfo;
  let stepIndex = 0;
  let taxEngineConfigured = true;
  let stepFailures: string[] = [];
  const companyId = String(process.env.TARGET_COMPANY_ID || '931').trim();
  const toErrorMessage = (error: unknown): string =>
    error instanceof Error ? error.message : String(error);
  const applyStepWait = async (): Promise<void> => {
    await currentPage.waitForLoadState('domcontentloaded').catch(() => {});
    await currentPage.waitForTimeout(500);
    await currentPage.waitForLoadState('networkidle').catch(() => {});
  };

  const runStep = async (name: string, action: () => Promise<void>): Promise<void> => {
    await test.step(name, async () => {
      stepIndex += 1;
      let stepStatus = 'passed';
      try {
        await applyStepWait();
        await action();
        await applyStepWait();
      } catch (error) {
        stepStatus = 'failed';
        stepFailures.push(`${name}: ${toErrorMessage(error)}`);
      } finally {
        const testCaseFolder = getTestCaseFolderName(currentTestInfo.title, currentTestInfo.file);
        const shortStepName = sanitizeForPath(name).slice(0, 40) || 'step';
        const screenshotPath = getScreenshotPathForTest(
          testCaseFolder,
          `${String(stepIndex).padStart(2, '0')}_${shortStepName}_${stepStatus}`
        );

        try {
          const activePage = currentPage.isClosed() ? currentPage.context().pages().at(-1) : currentPage;
          if (activePage && !activePage.isClosed()) {
            await activePage.screenshot({ path: screenshotPath, fullPage: true });
          }
        } catch {
          // Keep test flow stable even if screenshot capture fails.
        }
      }
    });
  };

  test.beforeEach(async ({ page }, testInfo) => {
    currentPage = page;
    currentTestInfo = testInfo;
    apHomePage = new APHomePage(page);
    smartAPListPage = new SmartAPListPage(page);
    smartApDetailPage = new SmartApDetailPage(page);
    taxAuthorityLevelPage = new TaxAuthorityLevelPage(page);
    stepFailures = [];
    taxEngineConfigured = true;
    stepIndex = 0;

    // Step 1: Open AP Home, switch company, then open Company Application Settings.
    await runStep('Open AP Home, switch company, open Company Application Settings', async () => {
      await smartApDetailPage.openHomePage();
      await apHomePage.changeCompanyId(companyId);
      await taxAuthorityLevelPage.configureCompanyAppSettingsForTaxAuthorityLevel();
    });
  });

  test('Open AP Invoice and choose Create From Scratch', async () => {
    test.setTimeout(10 * 60 * 1000);

    // Step 3: Navigate to AP Invoice.
    await runStep('Navigate to AP Invoice', async () => {
      await smartAPListPage.openApInvoiceFromQuickLinks();
    });

    // Step 4: Click Create New Invoice and choose Create From Scratch.
    await runStep('Click Create New Invoice and Create From Scratch', async () => {
      await taxAuthorityLevelPage.openCreateFromScratchForm();
    });

    // Step 5: Validate Authority Taxes section fields and look-and-feel.
    await runStep('Validate Authority Taxes UI and look-and-feel', async () => {
      await taxAuthorityLevelPage.validateAuthorityTaxesUi();
    });

    // Step 6: Enter subtotal and validate tax + total calculation.
    await runStep('Enter Subtotal 100 and validate Tax/Total amounts', async () => {
      await taxAuthorityLevelPage.enterSubtotalAndValidateTaxAndTotal(100);
    });

    // Step 7: Select tax authorities one by one and validate auto tax/total.
    await runStep('Select Tax Authorities and validate auto-calculated Tax/Total', async () => {
      await taxAuthorityLevelPage.selectTaxAuthoritiesAndValidateAmounts(100, [
        'TAX_AUTH_2',
        'TAX_AUTH_2',
        'TAX_AUTH_2',
        'TAX_AUTH_2',
      ]);
    });

    // Step 8: Populate invoice fields and select PO reference.
    await runStep('Step 8: Fill Invoice header and select PO reference', async () => {
      await taxAuthorityLevelPage.populateInvoiceHeaderAndSelectPoReference('Inv00012');
    });

    await runStep('Business/Data precheck for tax engine', async () => {
      const precheck = await taxAuthorityLevelPage.precheckTaxEngineConfigured();
      taxEngineConfigured = precheck.configured;
      if (!precheck.configured) {
        stepFailures.push(
          `Business/Data blocker: ${precheck.reason || 'Tax engine configuration not active for this tenant/data set.'}`
        );
      }
    });

    await runStep('Scenario 1: Edit Subtotal from 100 to 200', async () => {
      if (!taxEngineConfigured) return;
      await taxAuthorityLevelPage.scenario1_EditSubtotalAndValidateRecalc(200);
    });

    await runStep('Scenario 2: Change one selected Tax Authority', async () => {
      if (!taxEngineConfigured) return;
      await taxAuthorityLevelPage.scenario2_ChangeTaxAuthorityAndValidateRecalc();
    });

    await runStep('Scenario 3: Remove one selected Tax Authority', async () => {
      if (!taxEngineConfigured) return;
      await taxAuthorityLevelPage.scenario3_RemoveTaxAuthorityAndValidateRecalc();
    });

    await runStep('Scenario 4: Select all available Tax Authorities', async () => {
      if (!taxEngineConfigured) return;
      await taxAuthorityLevelPage.scenario4_SelectAllTaxAuthoritiesAndValidateTotals();
    });

    await runStep('Scenario 6: Manual Tax Amount override validation', async () => {
      await taxAuthorityLevelPage.scenario6_ManualOverrideValidation();
    });

    await runStep('Scenario 7: Zero subtotal validation', async () => {
      if (!taxEngineConfigured) return;
      await taxAuthorityLevelPage.scenario7_ZeroSubtotalValidation();
    });

    await runStep('Scenario 8: Decimal subtotal validation', async () => {
      if (!taxEngineConfigured) return;
      await taxAuthorityLevelPage.scenario8_DecimalSubtotalValidation(100.75);
    });

    await runStep('Scenario 9: Maximum subtotal validation', async () => {
      if (!taxEngineConfigured) return;
      await taxAuthorityLevelPage.scenario9_MaximumSubtotalValidation();
    });

    await runStep('Scenario 10: Refresh/reopen consistency validation', async () => {
      if (!taxEngineConfigured) return;
      await taxAuthorityLevelPage.scenario10_RefreshReopenValidation();
    });

    await test.step('Fail test if any step failed', async () => {
      if (stepFailures.length > 0) {
        throw new Error(`One or more steps failed:\n- ${stepFailures.join('\n- ')}`);
      }
    });
  });
});




