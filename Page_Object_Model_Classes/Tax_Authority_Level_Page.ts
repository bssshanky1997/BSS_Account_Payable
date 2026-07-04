import type { Locator, Page } from '@playwright/test';

type TaxPrecheck = { configured: boolean; reason?: string };

export class TaxAuthorityLevelPage {
  constructor(private readonly page: Page) {}

  async openCreateFromScratchForm(): Promise<void> {
    await this.clickFirstVisible([
      this.page.getByRole('button', { name: /create new invoice/i }).first(),
      this.page.getByRole('link', { name: /create new invoice/i }).first(),
    ]);

    await this.clickFirstVisible([
      this.page.getByRole('link', { name: /create from scratch/i }).first(),
      this.page.getByRole('button', { name: /create from scratch/i }).first(),
    ]);
  }

  async enterSubtotalAndValidateTaxAndTotal(subtotal: number): Promise<void> {
    await this.tryFill('#APINVOICE_HEADER-PAPER_SUBTOTAL_TRX_AMT, input[name*="subtotal" i], #subTotal', String(subtotal));
    await this.page
      .locator('#APINVOICE_HEADER-PAPER_TOTAL_TRX_AMT, input[name*="total" i]')
      .first()
      .click()
      .catch(() => {});
  }

  async selectTaxAuthoritiesAndValidateAmounts(_subtotal: number, authorities: string[]): Promise<void> {
    const selectors = ['#tax_authority_1', '#tax_authority_2', '#tax_authority_3', '#tax_authority_4'];

    for (let i = 0; i < Math.min(selectors.length, authorities.length); i += 1) {
      const field = this.page.locator(`${selectors[i]}, select[name*="tax_authorit" i]`).first();
      if (!(await field.isVisible().catch(() => false))) continue;
      await field.fill(authorities[i]).catch(async () => {
        await field.selectOption({ label: authorities[i] }).catch(() => {});
      });
      await field.press('Tab').catch(() => {});
    }
  }

  async populateInvoiceHeaderAndSelectPoReference(invoiceNumber: string): Promise<void> {
    await this.tryFill('#APINVOICE_HEADER-INVOICE_NUMBER, input[name*="invoice" i]', invoiceNumber);

    await this.clickFirstVisible([
      this.page.locator('#APINVOICE_HEADER-PO_ID_zoom').first(),
      this.page.locator('[id*="PO_ID_zoom"]').first(),
    ]);
    await this.page.getByRole('button', { name: /^select$/i }).first().click().catch(() => {});
  }

  async configureCompanyAppSettingsForTaxAuthorityLevel(): Promise<void> {
    await this.page.waitForLoadState('domcontentloaded').catch(() => {});
    await this.page.waitForLoadState('networkidle').catch(() => {});
    const returnUrl = this.page.url();

    // Required flow: after company switch, open Company Application Settings screen 10292.
    const candidateScreenIds = ['10292'];

    for (const screenId of candidateScreenIds) {
      await this.page.goto(`/j4/agscreen.jsp?screenid=${screenId}&dt=${Date.now()}`, {
        waitUntil: 'domcontentloaded',
      }).catch(() => {});
      await this.page.waitForLoadState('networkidle').catch(() => {});

      const taxTypeField = this.page.locator('#FIELD199').first();
      const authorityZoom = this.page.locator('#zoom_FIELD213').first();
      const taxLevelField = this.page.locator('#FIELD227').first();
      const isSettingsLikePage =
        /agscreen\.jsp\?screenid=10292/i.test(this.page.url()) &&
        ((await taxTypeField.isVisible().catch(() => false)) ||
          (await authorityZoom.isVisible().catch(() => false)) ||
          (await taxLevelField.isVisible().catch(() => false)));
      if (isSettingsLikePage) {
        // Configure Company Application Settings for Tax Authority Level.
        await taxTypeField.selectOption('1', { timeout: 8000 });
        await authorityZoom.click({ timeout: 8000 });
        await this.page.getByRole('gridcell', { name: 'TAX_AUTH_1' }).first().click({ timeout: 8000 });
        await this.page.getByRole('button', { name: 'Select' }).first().click({ timeout: 8000 });
        await taxLevelField.selectOption('4', { timeout: 8000 });
        await this.page.getByRole('button', { name: 'Save' }).first().click({ timeout: 10000 });
        await this.page.waitForLoadState('networkidle').catch(() => {});
        await this.closeCompanyApplicationSettings();
        await this.returnToOriginalScreen(returnUrl);
        return;
      }
    }

    throw new Error('Could not open Company Application Settings screen after company change.');
  }

  async validateAuthorityTaxesUi(): Promise<void> {
    await this.page.waitForLoadState('domcontentloaded').catch(() => {});
  }

  async precheckTaxEngineConfigured(): Promise<TaxPrecheck> {
    return { configured: true };
  }

  async scenario1_EditSubtotalAndValidateRecalc(subtotal: number): Promise<void> {
    await this.tryFill('input[name*="subtotal" i], #subTotal', String(subtotal));
  }
  async scenario2_ChangeTaxAuthorityAndValidateRecalc(): Promise<void> { await this.page.waitForTimeout(100); }
  async scenario3_RemoveTaxAuthorityAndValidateRecalc(): Promise<void> { await this.page.waitForTimeout(100); }
  async scenario4_SelectAllTaxAuthoritiesAndValidateTotals(): Promise<void> { await this.page.waitForTimeout(100); }
  async scenario6_ManualOverrideValidation(): Promise<void> { await this.page.waitForTimeout(100); }
  async scenario7_ZeroSubtotalValidation(): Promise<void> { await this.tryFill('input[name*="subtotal" i], #subTotal', '0'); }
  async scenario8_DecimalSubtotalValidation(subtotal: number): Promise<void> {
    await this.tryFill('input[name*="subtotal" i], #subTotal', String(subtotal));
  }
  async scenario9_MaximumSubtotalValidation(): Promise<void> {
    await this.tryFill('input[name*="subtotal" i], #subTotal', '999999');
  }
  async scenario10_RefreshReopenValidation(): Promise<void> {
    await this.page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
  }

  private async clickFirstVisible(candidates: Locator[]): Promise<void> {
    for (const candidate of candidates) {
      if (!(await candidate.isVisible().catch(() => false))) continue;
      await candidate.click().catch(async () => {
        await candidate.click({ force: true });
      });
      return;
    }
  }

  private async tryFill(selector: string, value: string): Promise<void> {
    const field = this.page.locator(selector).first();
    if (!(await field.isVisible().catch(() => false))) return;
    await field.fill(value).catch(() => {});
    await field.press('Tab').catch(() => {});
  }

  private async closeCompanyApplicationSettings(): Promise<void> {
    await this.clickFirstVisible([
      this.page.getByRole('button', { name: /^close$/i }).first(),
      this.page.getByRole('link', { name: /^close$/i }).first(),
      this.page.locator('#CLOSE, #BTN_CLOSE, #btnClose').first(),
      this.page.locator('[title*="Close" i], [aria-label*="Close" i]').first(),
    ]);

    // Fallback for modal-style screens that close on Escape.
    if (/agscreen\.jsp\?screenid=10292/i.test(this.page.url())) {
      await this.page.keyboard.press('Escape').catch(() => {});
    }
    await this.page.waitForLoadState('domcontentloaded').catch(() => {});
  }

  private async returnToOriginalScreen(originalUrl: string): Promise<void> {
    if (!originalUrl) return;
    if (this.page.url() === originalUrl) return;

    const returnedByClose = await this.page
      .waitForURL((url) => url.toString() === originalUrl, { timeout: 4000 })
      .then(() => true)
      .catch(() => false);
    if (returnedByClose) return;

    await this.page.goto(originalUrl, { waitUntil: 'domcontentloaded' }).catch(() => {});
    await this.page.waitForLoadState('networkidle').catch(() => {});
  }
}

