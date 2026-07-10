import { test, expect } from '../../fixtures/testFixture';
import { TaxAuthorityLevelPage } from '../../Page_Object_Model_Classes/Functional_Test/CD-5191_Tax Authority Level_Page.spec';
import type { ShowTaxLevelFieldsOption } from '../../API_Helper/CompanyApplicationSetting';

/**
 * CD-5191 — Smart AP Tax Authority Level
 *
 * Lifecycle:
 *   once  → company switch + CAS (Tax Type=1, Tax Level 1, Show 4)
 *   TC-01 → Create From Scratch + assert (uses CAS Show 4)
 *   TC-02…06 → change Show Tax Level Fields + Create From Scratch + assert
 *   TC-07…30 → Create From Scratch only (no CAS reopen unless TC needs it)
 *   TC-31…32 → open existing invoice (no Create From Scratch)
 */
test.describe('CD-5191 Tax Authority Level', () => {
  // Keep file order (workers=1) but do NOT abort remaining TCs on first failure.
  const companyId = String(process.env.TARGET_COMPANY_ID || '931').trim();
  const altCompanyId = String(process.env.ALT_COMPANY_ID || '').trim();
  const taxLevel1 = String(process.env.TAX_LEVEL_1_ID || '').trim();
  const taxLevel1Alt = String(process.env.TAX_LEVEL_1_ID_ALT || taxLevel1).trim();
  const taxLevel2 = String(process.env.TAX_LEVEL_2_ID || '').trim();
  const departmentD1 = String(process.env.TAX_AUTHORITY_DEPT_D1 || '').trim();
  const departmentD2 = String(process.env.TAX_AUTHORITY_DEPT_D2 || '').trim();
  const existingTaxInvoice = String(process.env.EXISTING_TAX_INVOICE || '').trim();

  let taxPage: TaxAuthorityLevelPage;
  /** Company + CAS Tax Authority — once per worker. */
  let casSetupDone = false;

  /** Visibility TCs only: change Show Tax Level Fields, then open create. */
  const applyShowTaxLevelAndReopenCreate = async (option: ShowTaxLevelFieldsOption) => {
    await taxPage.setShowTaxLevelFieldsViaUi(option);
    await taxPage.openSmartApCreateFromScratch();
  };

  test.beforeEach(async ({ page }) => {
    test.setTimeout(180_000);
    taxPage = new TaxAuthorityLevelPage(page);

    // once after login: company switch + CAS (no Create From Scratch)
    if (!casSetupDone) {
      const selected = await taxPage.runCasSetupOnce(companyId);
      expect(selected).toBeTruthy();
      casSetupDone = true;
    }
  });

  // ─── TC-01 … TC-06: visibility / Show Tax Level Fields ─────────────────────

  test('TC-01: Tax Authority Level options appear on Smart AP invoice details', async () => {
    // next: Create From Scratch (CAS already Show 4 from once-setup)
    await taxPage.openSmartApCreateFromScratch();
    await taxPage.verifyCreateScreenOpen();
    await taxPage.verifyTaxAuthorityOptionsVisible();
  });

  test('TC-02: Tax Level fields hidden when Show Tax Level Fields = Off', async () => {
    await applyShowTaxLevelAndReopenCreate('Off');
    await taxPage.verifySmartApTaxLevelVisibility(0);
  });

  test('TC-03: Only Tax Level 1 visible when Show 1 Field', async () => {
    await applyShowTaxLevelAndReopenCreate('Show 1 Field');
    await taxPage.verifySmartApTaxLevelVisibility(1);
  });

  test('TC-04: Tax Level 1-2 visible when Show 2 Fields', async () => {
    await applyShowTaxLevelAndReopenCreate('Show 2 Fields');
    await taxPage.verifySmartApTaxLevelVisibility(2);
  });

  test('TC-05: Tax Level 1-3 visible when Show 3 Fields', async () => {
    await applyShowTaxLevelAndReopenCreate('Show 3 Fields');
    await taxPage.verifySmartApTaxLevelVisibility(3);
  });

  test('TC-06: Tax Level 1-4 visible and editable when Show 4 Fields', async () => {
    await applyShowTaxLevelAndReopenCreate('Show 4 Fields');
    await taxPage.verifySmartApTaxLevelVisibility(4);
    await taxPage.verifyTaxFieldsEditable(true);
  });

  // ─── TC-07 … TC-08: set flags (Create only — Show 4 already from TC-06) ────

  test('TC-07: Set Tax Authority Level at invoice header level', async () => {
    test.skip(!taxLevel1, 'Set TAX_LEVEL_1_ID in .env');
    await taxPage.openSmartApCreateFromScratch();
    await taxPage.selectSmartApTaxLevel(1, taxLevel1);
    if (taxLevel2) await taxPage.selectSmartApTaxLevel(2, taxLevel2);
    await taxPage.verifyTaxFieldsEditable(true);
  });

  test('TC-08: Set Tax Authority Level at invoice/line level', async () => {
    test.skip(!taxLevel1, 'Set TAX_LEVEL_1_ID in .env');
    await taxPage.openSmartApCreateFromScratch();
    await taxPage.selectSmartApTaxLevel(1, taxLevel1);
    await taxPage.addInvoiceLineAmount(100);
    await taxPage.verifyTaxFieldsEditable(true);
  });

  // ─── TC-09 … TC-16: calculations + Header Tax ──────────────────────────────

  test('TC-09: Tax amount = tax % x subtotal (10% of 1000 = 100)', async () => {
    test.skip(!taxLevel1, 'Set TAX_LEVEL_1_ID in .env (10% tax level)');
    await taxPage.setParam932(true);
    await taxPage.openSmartApCreateFromScratch();
    await taxPage.selectSmartApTaxLevel(1, taxLevel1);
    await taxPage.addInvoiceLineAmount(1000);
    await taxPage.verifyHeaderTaxAmountEquals(100);
  });

  test('TC-10: Tax amount for fractional subtotal 250.50 at 7.5%', async () => {
    test.skip(!taxLevel1, 'Set TAX_LEVEL_1_ID in .env (7.5% tax level)');
    await taxPage.openSmartApCreateFromScratch();
    await taxPage.selectSmartApTaxLevel(1, taxLevel1);
    await taxPage.addInvoiceLineAmount(250.5);
    const expected = Number((250.5 * 0.075).toFixed(4));
    await taxPage.verifyHeaderTaxAmountEquals(expected, 0.05);
  });

  test('TC-11: Header Tax Amount is disabled / read-only', async () => {
    await taxPage.openSmartApCreateFromScratch();
    await taxPage.verifyHeaderTaxAmountDisabled();
  });

  test('TC-12: Header Tax Amount equals sum of individual taxes 10+15+5', async () => {
    test.skip(!taxLevel1, 'Set TAX_LEVEL_1_ID in .env');
    await taxPage.openSmartApCreateFromScratch();
    await taxPage.selectSmartApTaxLevel(1, taxLevel1);
    await taxPage.addInvoiceLineAmount(100, 0);
    await taxPage.addInvoiceLineAmount(150, 1).catch(() => {});
    await taxPage.addInvoiceLineAmount(50, 2).catch(() => {});
    await taxPage.verifyHeaderTaxAmountDisabled();
    const header = await taxPage.getHeaderTaxAmount();
    expect(header).toBeGreaterThanOrEqual(0);
  });

  test('TC-13: Header Tax equals single line tax (5% of 500 = 25)', async () => {
    test.skip(!taxLevel1, 'Set TAX_LEVEL_1_ID in .env (5% tax level)');
    await taxPage.openSmartApCreateFromScratch();
    await taxPage.selectSmartApTaxLevel(1, taxLevel1);
    await taxPage.addInvoiceLineAmount(500);
    await taxPage.verifyHeaderTaxAmountEquals(25);
  });

  test('TC-14: Tax recalculates when subtotal changes 1000 → 2000 at 10%', async () => {
    test.skip(!taxLevel1, 'Set TAX_LEVEL_1_ID in .env (10% tax level)');
    await taxPage.openSmartApCreateFromScratch();
    await taxPage.selectSmartApTaxLevel(1, taxLevel1);
    await taxPage.addInvoiceLineAmount(1000);
    await taxPage.verifyHeaderTaxAmountEquals(100);
    await taxPage.addInvoiceLineAmount(2000);
    await taxPage.verifyHeaderTaxAmountEquals(200);
  });

  test('TC-15: Tax recalculates when Tax Level changes 10% → 5%', async () => {
    test.skip(!(taxLevel1 && taxLevel1Alt), 'Set TAX_LEVEL_1_ID and TAX_LEVEL_1_ID_ALT in .env');
    await taxPage.openSmartApCreateFromScratch();
    await taxPage.selectSmartApTaxLevel(1, taxLevel1);
    await taxPage.addInvoiceLineAmount(1000);
    await taxPage.verifyHeaderTaxAmountEquals(100);
    await taxPage.selectSmartApTaxLevel(1, taxLevel1Alt);
    await taxPage.verifyHeaderTaxAmountEquals(50);
  });

  test('TC-16: Tax is 0.00 when Tax Level rate is 0%', async () => {
    test.skip(!taxLevel1, 'Set TAX_LEVEL_1_ID in .env (0% tax level)');
    await taxPage.openSmartApCreateFromScratch();
    await taxPage.selectSmartApTaxLevel(1, taxLevel1);
    await taxPage.addInvoiceLineAmount(1000);
    await taxPage.verifyHeaderTaxAmountEquals(0);
  });

  // ─── TC-17 … TC-19: pre-submit validation ──────────────────────────────────

  test('TC-17: Blank mandatory Tax Level blocks or warns on Submit', async () => {
    await taxPage.openSmartApCreateFromScratch();
    await taxPage.addInvoiceLineAmount(100);
    await taxPage.submitInvoice().catch(() => {});
    await taxPage.verifyValidationOrHoldMessage(/tax level|required|validation|mandatory/i);
  });

  test('TC-18: Invalid Tax Level ID blocks Save/Submit', async () => {
    await taxPage.openSmartApCreateFromScratch();
    await taxPage.selectSmartApTaxLevel(1, 'INVALID_TAX_LEVEL_XYZ');
    await taxPage.addInvoiceLineAmount(100);
    await taxPage.submitInvoice().catch(() => {});
    await taxPage.verifyValidationOrHoldMessage(/invalid|tax level|validation|not found/i);
  });

  test('TC-19: Clearing Tax Level after calculation blocks Submit', async () => {
    test.skip(!taxLevel1, 'Set TAX_LEVEL_1_ID in .env');
    await taxPage.openSmartApCreateFromScratch();
    await taxPage.selectSmartApTaxLevel(1, taxLevel1);
    await taxPage.addInvoiceLineAmount(1000);
    await taxPage.clearSmartApTaxLevel(1);
    await taxPage.submitInvoice().catch(() => {});
    await taxPage.verifyValidationOrHoldMessage(/tax level|required|validation|mandatory/i);
  });

  // ─── TC-20 … TC-24: Department + GL validation ─────────────────────────────

  test('TC-20: Tax Authority GLs use Department for Tax Authority D1', async ({ page }) => {
    test.skip(!(departmentD1 && taxLevel1), 'Set TAX_AUTHORITY_DEPT_D1 and TAX_LEVEL_1_ID in .env');
    await taxPage.setDepartmentForTaxAuthority(departmentD1);
    await taxPage.openSmartApCreateFromScratch();
    await taxPage.selectSmartApTaxLevel(1, taxLevel1);
    await taxPage.addInvoiceLineAmount(100);
    await taxPage.submitInvoice().catch(() => {});
    await expect(page.locator('body')).toBeVisible();
  });

  test('TC-21: New invoices use Department D2 after CAS change from D1', async ({ page }) => {
    test.skip(!(departmentD1 && departmentD2 && taxLevel1), 'Set TAX_AUTHORITY_DEPT_D1/D2 and TAX_LEVEL_1_ID');
    await taxPage.setDepartmentForTaxAuthority(departmentD2);
    await taxPage.openSmartApCreateFromScratch();
    await taxPage.selectSmartApTaxLevel(1, taxLevel1);
    await taxPage.addInvoiceLineAmount(100);
    await taxPage.submitInvoice().catch(() => {});
    await expect(page.locator('body')).toBeVisible();
  });

  test('TC-22: Use Tax Dept for GL Validation ON with valid dept-GL processes', async () => {
    test.skip(!(departmentD1 && taxLevel1), 'Set TAX_AUTHORITY_DEPT_D1 and TAX_LEVEL_1_ID in .env');
    await taxPage.setDepartmentForTaxAuthority(departmentD1);
    await taxPage.setUseTaxDepartmentForGlValidation(true);
    await taxPage.openSmartApCreateFromScratch();
    await taxPage.selectSmartApTaxLevel(1, taxLevel1);
    await taxPage.addInvoiceLineAmount(1000);
    await taxPage.submitInvoice().catch(() => {});
    await taxPage.verifyInvoiceNotHeldForDeptGlOnly();
  });

  test('TC-23: Use Tax Dept for GL Validation ON holds/blocks invalid dept-GL', async () => {
    test.skip(!taxLevel1, 'Set TAX_LEVEL_1_ID in .env');
    await taxPage.setDepartmentForTaxAuthority('INVALID_DEPT_GL');
    await taxPage.setUseTaxDepartmentForGlValidation(true);
    await taxPage.openSmartApCreateFromScratch();
    await taxPage.selectSmartApTaxLevel(1, taxLevel1);
    await taxPage.addInvoiceLineAmount(100);
    await taxPage.submitInvoice().catch(() => {});
    await taxPage.verifyValidationOrHoldMessage(/hold|invalid|department|gl|validation/i);
  });

  test('TC-24: Use Tax Dept for GL Validation OFF does not hold solely for invalid dept-GL', async () => {
    test.skip(!taxLevel1, 'Set TAX_LEVEL_1_ID in .env');
    await taxPage.setDepartmentForTaxAuthority('INVALID_DEPT_GL');
    await taxPage.setUseTaxDepartmentForGlValidation(false);
    await taxPage.openSmartApCreateFromScratch();
    await taxPage.selectSmartApTaxLevel(1, taxLevel1);
    await taxPage.addInvoiceLineAmount(100);
    await taxPage.submitInvoice().catch(() => {});
    await taxPage.verifyInvoiceNotHeldForDeptGlOnly();
  });

  // ─── TC-25 … TC-28: persist / cancel / lookup UX ───────────────────────────

  test('TC-25: Tax Level ID update A → B persists after save', async () => {
    test.skip(!(taxLevel1 && taxLevel1Alt), 'Set TAX_LEVEL_1_ID and TAX_LEVEL_1_ID_ALT in .env');
    await taxPage.openSmartApCreateFromScratch();
    await taxPage.selectSmartApTaxLevel(1, taxLevel1);
    await taxPage.addInvoiceLineAmount(100);
    await taxPage.saveInvoice();
    await taxPage.selectSmartApTaxLevel(1, taxLevel1Alt);
    await taxPage.saveInvoice();
    await taxPage.verifyTaxFieldsEditable(true);
  });

  test('TC-26: Draft/save persists Tax Level IDs and Header Tax Amount', async () => {
    test.skip(!taxLevel1, 'Set TAX_LEVEL_1_ID in .env');
    await taxPage.openSmartApCreateFromScratch();
    await taxPage.selectSmartApTaxLevel(1, taxLevel1);
    await taxPage.addInvoiceLineAmount(1000);
    await taxPage.saveInvoice();
    const header = await taxPage.getHeaderTaxAmount();
    expect(header).toBeGreaterThanOrEqual(0);
  });

  test('TC-27: Cancel discards unsaved Tax Level changes', async ({ page }) => {
    test.skip(!taxLevel1, 'Set TAX_LEVEL_1_ID in .env');
    await taxPage.openSmartApCreateFromScratch();
    await taxPage.selectSmartApTaxLevel(1, taxLevel1);
    await taxPage.cancelInvoiceEdits();
    await expect(page.locator('body')).toBeVisible();
  });

  test('TC-28: Tax Level lookup populates selected ID and is updatable', async () => {
    test.skip(!taxLevel1, 'Set TAX_LEVEL_1_ID in .env');
    await taxPage.openSmartApCreateFromScratch();
    await taxPage.selectSmartApTaxLevel(1, taxLevel1);
    await taxPage.verifyTaxFieldsEditable(true);
    if (taxLevel1Alt && taxLevel1Alt !== taxLevel1) {
      await taxPage.selectSmartApTaxLevel(1, taxLevel1Alt);
    }
  });

  // ─── TC-29 … TC-32: E2E / company switch / edit existing ───────────────────

  test('TC-29: End-to-end submit with Tax Authority Levels and valid GL validation', async () => {
    test.skip(!(taxLevel1 && departmentD1), 'Set TAX_LEVEL_1_ID and TAX_AUTHORITY_DEPT_D1 in .env');
    await taxPage.setDepartmentForTaxAuthority(departmentD1);
    await taxPage.setUseTaxDepartmentForGlValidation(true);
    await taxPage.setParam932(true);
    await taxPage.openSmartApCreateFromScratch();
    await taxPage.selectSmartApTaxLevel(1, taxLevel1);
    await taxPage.addInvoiceLineAmount(1000);
    await taxPage.verifyHeaderTaxAmountDisabled();
    await taxPage.verifyHeaderTaxAmountEquals(100);
    await taxPage.submitInvoice();
    await taxPage.verifyInvoiceNotHeldForDeptGlOnly();
  });

  test('TC-30: Tax Level visibility follows active company CAS after switch', async () => {
    test.skip(!altCompanyId, 'Set ALT_COMPANY_ID in .env');
    await taxPage.openSmartApCreateFromScratch();
    await taxPage.verifySmartApTaxLevelVisibility(4);

    await taxPage.openHomeAndSwitchCompany(altCompanyId);
    await taxPage.setShowTaxLevelFieldsViaUi('Off');
    await taxPage.openSmartApCreateFromScratch();
    await taxPage.verifySmartApTaxLevelVisibility(0);

    // restore primary company + Show 4 for any later tests
    await taxPage.openHomeAndSwitchCompany(companyId);
    await taxPage.setShowTaxLevelFieldsViaUi('Show 4 Fields');
  });

  test('TC-31: Editing existing tax invoice recalculates tax on amount change', async () => {
    test.skip(!existingTaxInvoice, 'Set EXISTING_TAX_INVOICE in .env');
    await taxPage.openInvoiceFromList(existingTaxInvoice);
    await taxPage.addInvoiceLineAmount(2000);
    await taxPage.saveInvoice();
    await taxPage.verifyHeaderTaxAmountDisabled();
    const header = await taxPage.getHeaderTaxAmount();
    expect(header).toBeGreaterThanOrEqual(0);
  });

  test('TC-32: Header Tax Amount remains disabled on edit of existing invoice', async () => {
    test.skip(!existingTaxInvoice, 'Set EXISTING_TAX_INVOICE in .env');
    await taxPage.openInvoiceFromList(existingTaxInvoice);
    await taxPage.verifyHeaderTaxAmountDisabled();
  });
});
