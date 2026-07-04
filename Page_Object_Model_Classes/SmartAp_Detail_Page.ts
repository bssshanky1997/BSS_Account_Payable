import { type Locator, type Page } from '@playwright/test';

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

export class SmartApDetailPage {
  constructor(private readonly page: Page) {}

  async openHomePage(): Promise<void> {
    await this.page.goto('/j4/default.jsp');
    await this.page.waitForLoadState('domcontentloaded');
  }

  async openApInvoicePage(): Promise<void> {
    const apCardQuickLinks = this.page
      .locator('div:has(h5:has-text("Accounts Payable")) button:has-text("Quick Links")')
      .first();
    const apInvoiceLink = this.page.getByRole('link', { name: /^ap\s*invoice$/i }).first();

    if (await apCardQuickLinks.isVisible().catch(() => false)) {
      await apCardQuickLinks.click().catch(() => {});
    }
    if (await apInvoiceLink.isVisible().catch(() => false)) {
      await apInvoiceLink.click().catch(() => {});
      return;
    }
    await this.page.goto('/j4/SmartAP.jsp', { waitUntil: 'domcontentloaded' }).catch(() => {});
  }

  async createInvoiceFromScratch(data: CreateInvoiceData): Promise<void> {
    await this.waitAndClick(this.page.getByRole('button', { name: 'Create New Invoice' }));
    await this.waitAndClick(this.page.getByRole('link', { name: 'Create From Scratch' }));
    await this.waitAndFill(this.page.getByRole('textbox', { name: 'Invoice number *' }), data.invoiceNumber);
    await this.waitAndFill(this.page.getByRole('textbox', { name: 'Invoice Date *' }), data.invoiceDate);
    await this.waitAndClick(this.page.locator('#APINVOICE_HEADER-SUPPLIER_COMPANY_ID_zoom'));
    await this.waitAndClick(this.page.getByRole('gridcell', { name: data.supplierName }).first());
    await this.waitAndClick(this.page.getByRole('button', { name: 'Select' }));
    await this.waitAndClick(this.page.locator('#APINVOICE_HEADER-PAYMENT_METHOD_ID_zoom'));
    await this.waitAndClick(this.page.getByRole('gridcell', { name: '4' }).first());
    await this.waitAndClick(this.page.getByRole('button', { name: 'Select' }));
    await this.waitAndClick(this.page.getByRole('link', { name: '+ Add Row' }));

    const frame = this.page.locator('#jsp-frame').contentFrame();
    await this.waitAndFill(frame.locator('#APINVOICE_DETAIL-SUPPLIER_SKU'), data.supplierSku);
    await this.waitAndFill(frame.locator('#APINVOICE_DETAIL-ITEM_DESCRIPTION'), data.itemDescription);
    await this.waitAndClick(frame.locator('#department_zoom'));
    await this.waitAndClick(frame.getByRole('gridcell', { name: data.departmentName }).first());
    await this.waitAndClick(frame.getByRole('button', { name: 'Select' }));
    await this.waitAndClick(frame.locator('#gl_account_zoom'));
    await this.waitAndClick(frame.getByRole('gridcell', { name: data.glAccount }).first());
    await this.waitAndClick(frame.getByRole('button', { name: 'Select' }));
    await this.waitAndFill(frame.locator('#APINVOICE_DETAIL-INVOICED_TOTAL_QTY'), data.quantity);
    await this.waitAndFill(frame.locator('#APINVOICE_DETAIL-INVOICE_UNIT_TRX_PRICE'), data.unitPrice);
    await this.waitAndFill(frame.locator('#APINVOICE_DETAIL-INVOICE_UOM_CODE'), data.uomCode);
    await this.waitAndClick(frame.locator('#tax_code_1_zoom'));
    await this.waitAndClick(frame.getByRole('gridcell', { name: new RegExp(data.taxCode, 'i') }).first());
    await this.waitAndClick(frame.getByRole('button', { name: 'Select' }));
    await this.waitAndClick(frame.getByRole('button', { name: 'OK' }));

    await this.waitAndFill(this.page.locator('#APINVOICE_HEADER-PAPER_SUBTOTAL_TRX_AMT'), data.subTotal);
    await this.waitAndFill(this.page.locator('#APINVOICE_HEADER-PAPER_TAX_TRX_AMT'), data.taxAmount);
    await this.waitAndClick(this.page.locator('#APINVOICE_HEADER-PAPER_TOTAL_TRX_AMT'));
  }

  async saveInvoiceDismissDialog(): Promise<void> {
    this.page.once('dialog', (dialog) => {
      dialog.dismiss().catch(() => {});
    });
    await this.page.getByRole('button', { name: 'Save' }).click();
  }

  async openInvoiceDetailUrl(url: string): Promise<void> {
    await this.page.goto(url);
  }

  private async waitAndClick(locator: Locator): Promise<void> {
    await locator.waitFor({ state: 'visible', timeout: 30_000 });
    await locator.click();
  }

  private async waitAndFill(locator: Locator, value: string): Promise<void> {
    await locator.waitFor({ state: 'visible', timeout: 30_000 });
    await locator.fill(value);
  }
}
