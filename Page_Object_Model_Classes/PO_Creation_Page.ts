import type { FrameLocator, Locator, Page } from '@playwright/test';
import { waitForLoaderToDisappear } from '../utils/helpers';

export class POCreationPage {
  constructor(private readonly page: Page) {}

  async ensureVisible(locator: Locator, timeoutMs = 20_000): Promise<void> {
    await locator.waitFor({ state: 'visible', timeout: timeoutMs });
  }

  async clickWithOverlayGuard(locator: Locator): Promise<void> {
    await waitForLoaderToDisappear(this.page);
    await locator.click().catch(() => locator.click({ force: true }));
  }

  async firstVisible(candidates: Locator[], timeoutMs = 20_000): Promise<Locator> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      for (const c of candidates) {
        const n = await c.count().catch(() => 0);
        for (let i = 0; i < n; i += 1) {
          const node = c.nth(i);
          if (await node.isVisible().catch(() => false)) return node;
        }
      }
      await this.page.waitForTimeout(150);
    }
    throw new Error('Could not find a visible element for the requested action.');
  }

  async scrollGridToRight(): Promise<void> {
    await this.page.locator('.ag-body-horizontal-scroll-viewport, .ag-center-cols-viewport').first().evaluate((el) => {
      (el as HTMLElement).scrollLeft = (el as HTMLElement).scrollWidth;
    });
  }

  async getGridCell(columnNameRegex: RegExp, fallbackCellIndex: number): Promise<Locator> {
    const row = this.page.locator('.ag-center-cols-container .ag-row').first();
    const header = this.page.getByRole('columnheader', { name: columnNameRegex }).first();
    const ariaIndex = await header.getAttribute('aria-colindex').catch(() => null);
    if (ariaIndex) return row.locator(`[role="gridcell"][aria-colindex="${ariaIndex}"]`).first();
    return row.getByRole('gridcell').nth(fallbackCellIndex);
  }

  async editGridCellAndTab(columnNameRegex: RegExp, fallbackCellIndex: number, value: string): Promise<void> {
    const cell = await this.getGridCell(columnNameRegex, fallbackCellIndex);
    await cell.dblclick();
    await this.page.keyboard.press('Control+A');
    await this.page.keyboard.type(value);
    await this.page.keyboard.press('Tab');
  }

  async openSpecialOrderItemsFromSidebar(): Promise<void> {
    await this.sidebarToggle.click();
    await this.purchasingLink.click();
    await this.specialOrderItemsIcon.click();
    await this.page.waitForLoadState('domcontentloaded');
  }

  async getSelectedSupplierValue(): Promise<string> {
    return (await this.supplierHiddenValueField.getAttribute('value').catch(() => null)) ?? '';
  }

  get sidebarToggle(): Locator { return this.page.locator('#sidebarToggle'); }
  get purchasingLink(): Locator { return this.page.getByTitle('Purchasing'); }
  get specialOrderItemsIcon(): Locator { return this.page.getByRole('img', { name: 'Special Order Items' }); }
  get selectSupplierButton(): Locator { return this.page.getByRole('button', { name: 'Select Supplier' }); }
  get formWindowIframe(): Locator { return this.page.locator('iframe[name="formWindow"]'); }
  get supplierHiddenValueField(): Locator { return this.page.locator('#FREEFORM_SUPPLIER_COMPANY_VALUE'); }
  get createPoButton(): Locator { return this.page.getByRole('button', { name: /create\s*po/i }); }
  get submitButton(): Locator { return this.page.getByRole('button', { name: 'Submit' }); }
  get moreOptionsButton(): Locator { return this.page.getByTitle('More Options'); }
  get reloadGridDataOption(): Locator { return this.page.getByText('Reload Grid Data'); }
  firstResultRow(): Locator { return this.page.locator('.ag-center-cols-container .ag-row').first(); }
  poGridCell(poNumber: string): Locator { return this.page.getByRole('gridcell', { name: new RegExp(poNumber, 'i') }).first(); }
  get overlay(): Locator { return this.page.locator('.ui-widget-overlay'); }
  get selectExactButton(): Locator { return this.page.getByRole('button', { name: 'Select', exact: true }); }
  get demoAhrCategoryOption(): Locator { return this.page.locator('span').filter({ hasText: /^DEMO_AHR$/ }).first(); }
  get firstTaxCodeRow(): Locator { return this.page.getByRole('gridcell', { name: 'TAX CODE' }).nth(1); }
  get tcosCell(): Locator { return this.page.getByRole('gridcell', { name: 'TCOS' }); }
  get glAccountCell(): Locator { return this.page.getByRole('gridcell', { name: '1400.345540' }); }
  get supplierReturnButton(): Locator { return this.page.locator('#RetSupp').first(); }
  supplierCellInMainPopup(): Locator { return this.page.getByRole('cell', { name: /4 IMPRINT INC 14839|4 IMPRINT INC/i }).first(); }
  supplierTextInMainPopup(): Locator { return this.page.getByText(/4 IMPRINT INC 14839|4 IMPRINT INC/i).first(); }
  selectButtonGeneric(): Locator { return this.page.getByRole('button', { name: /^select$/i }).first(); }
  dialogIframeCandidates(): Locator[] { return [this.page.locator('iframe[name="_dlgOpenerIframe6"]'), this.page.locator('iframe[name="_dlgOpenerIframe5"]')]; }
  async getPoDialogFrame(): Promise<FrameLocator> { return (await this.firstVisible(this.dialogIframeCandidates(), 15_000)).contentFrame(); }
  dialogSubjectField(frame: FrameLocator): Locator { return frame.locator('#subject'); }
  dialogField17(frame: FrameLocator): Locator { return frame.locator('#FIELD17'); }
  dialogNoteField(frame: FrameLocator): Locator { return frame.locator('#Note'); }
  dialogProdType(frame: FrameLocator): Locator { return frame.locator('#prodType'); }
  dialogZoomDepartment(frame: FrameLocator): Locator { return frame.locator('#zoom_dep'); }
  dialogZoomGl(frame: FrameLocator): Locator { return frame.locator('#zoom_gl'); }
  dialogGlImageCell(frame: FrameLocator): Locator { return frame.getByRole('cell', { name: '2650.120600' }).getByRole('img'); }
  dialogOkButton(frame: FrameLocator): Locator { return frame.getByRole('button', { name: 'OK' }); }
  taxCodeSearchGlassCandidates(): Locator[] {
    return [
      this.page.locator('button[id*="taxcode" i], a[id*="taxcode" i], img[id*="taxcode" i]'),
      this.page.getByRole('button', { name: /tax\s*code|tax/i }),
    ];
  }
}
