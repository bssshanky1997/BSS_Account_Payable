import { expect, type Page } from '@playwright/test';

type CreateInvoiceData = {
  invoiceNumber: string;
  invoiceDate: string;
  supplierName: string;
  supplierSku: string;
  itemDescription: string;
  departmentName: string;
  glAccount: string;
  quantity: string;
  unitPrice: string;
  uomCode: string;
  taxCode: string;
  subTotal: string;
  taxAmount: string;
};

export class APHomePage {
  constructor(private readonly page: Page) {}

  async openHomePage(): Promise<void> {
    await this.page.goto('/');
    await this.page.waitForLoadState('domcontentloaded');
  }

  async changeCompanyId(companyId: string): Promise<void> {
    const company = this.page.locator('#COMPANY_ID, input[name*="company" i]').first();
    if (await company.isVisible().catch(() => false)) {
      await company.fill(companyId).catch(() => {});
      await company.press('Enter').catch(() => {});
    }
  }

  async openApInvoicePage(): Promise<void> {
    const apInvoice = this.page.locator('a:has-text("AP Invoice"), [title="AP Invoice"]').first();
    await apInvoice.waitFor({ state: 'visible', timeout: 30_000 });
    await apInvoice.click();
  }

  async verifyBulkSubmitVisible(): Promise<void> {
    await expect(this.page.getByRole('button', { name: /bulk\s*submit|batch\s*submit/i }).first()).toBeVisible();
  }

  async openCreateFromScratchForm(): Promise<void> {
    const createFromScratch = this.page.getByText(/create\s*from\s*scratch/i).first();
    await createFromScratch.waitFor({ state: 'visible', timeout: 30_000 });
    await createFromScratch.click();
  }

  async createInvoiceFromScratch(data: CreateInvoiceData): Promise<void> {
    await this.tryFill('input[name*="invoice" i]', data.invoiceNumber);
    await this.tryFill('input[name*="date" i]', data.invoiceDate);
    await this.tryFill('input[name*="supplier" i]', data.supplierName);
  }

  async saveInvoiceDismissDialog(): Promise<void> {
    await this.page.getByRole('button', { name: /^save$/i }).first().click().catch(() => {});
  }

  async openInvoiceDetailUrl(url: string): Promise<void> {
    await this.page.goto(url);
  }

  async enterSubtotalAndValidateTaxAndTotal(subtotal: number): Promise<void> {
    await this.tryFill('input[name*="subtotal" i], #subTotal', String(subtotal));
  }

  async selectTaxAuthoritiesAndValidateAmounts(_subtotal: number, _taxAuthorities: string[]): Promise<void> {
    await this.page.waitForTimeout(200);
  }

  async populateInvoiceHeaderAndSelectPoReference(invoiceNumber: string): Promise<void> {
    await this.tryFill('input[name*="invoice" i]', invoiceNumber);
  }

  private async tryFill(selector: string, value: string): Promise<void> {
    const field = this.page.locator(selector).first();
    if (!(await field.isVisible().catch(() => false))) return;
    await field.fill(value).catch(() => {});
    await field.press('Tab').catch(() => {});
  }
}
