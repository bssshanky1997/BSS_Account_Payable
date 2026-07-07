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

  private async clearBlockingUiArtifacts(): Promise<void> {
    await waitForLoaderToDisappear(this.page);
    await this.page.keyboard.press('Escape').catch(() => {});
    await this.overlay.waitFor({ state: 'hidden', timeout: 2_000 }).catch(() => {});
  }

  private async activateGridCellForEdit(cell: Locator): Promise<void> {
    await this.ensureVisible(cell, 20_000);
    await cell.scrollIntoViewIfNeeded().catch(() => {});
    await this.clearBlockingUiArtifacts();

    try {
      await cell.dblclick({ timeout: 7_000 });
      return;
    } catch {
      await this.clearBlockingUiArtifacts();
      await cell.click({ force: true });
      await this.page.waitForTimeout(100);
      await cell.click({ force: true });
    }
  }

  async firstVisible(candidates: Locator[], timeoutMs = 20_000): Promise<Locator> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (this.page.isClosed()) {
        throw new Error('Page closed while waiting for a visible element.');
      }
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

  private async findVisibleDialogIframe(timeoutMs = 30_000): Promise<Locator | null> {
    const deadline = Date.now() + timeoutMs;
    const iframeCandidates = this.page.locator(
      'iframe[name*="_dlgOpenerIframe"], iframe[id*="_dlgOpenerIframe"], iframe[name*="dlgOpener"], iframe[id*="dlgOpener"]'
    );

    while (Date.now() < deadline) {
      if (this.page.isClosed()) return null;
      const count = await iframeCandidates.count().catch(() => 0);
      for (let i = 0; i < count; i += 1) {
        const frame = iframeCandidates.nth(i);
        if (await frame.isVisible().catch(() => false)) return frame;
      }
      await this.page.waitForTimeout(200).catch(() => {});
    }
    return null;
  }

  private async findDialogIframeByContent(timeoutMs = 30_000): Promise<Locator | null> {
    const deadline = Date.now() + timeoutMs;
    const allIframes = this.page.locator('iframe');

    while (Date.now() < deadline) {
      if (this.page.isClosed()) return null;

      const frameCount = await allIframes.count().catch(() => 0);
      for (let i = 0; i < frameCount; i += 1) {
        const iframe = allIframes.nth(i);
        const frameLocator = iframe.contentFrame();

        const hasSubject = (await frameLocator.locator('#subject').count().catch(() => 0)) > 0;
        const hasField17 = (await frameLocator.locator('#FIELD17').count().catch(() => 0)) > 0;
        if (hasSubject || hasField17) return iframe;
      }

      await this.page.waitForTimeout(200).catch(() => {});
    }

    return null;
  }

  async scrollGridToRight(): Promise<void> {
    const gridViewport = this.page.locator('.ag-body-horizontal-scroll-viewport, .ag-center-cols-viewport').first();
    await this.ensureVisible(gridViewport, 20_000);
    await gridViewport.evaluate((el) => {
      (el as HTMLElement).scrollLeft = (el as HTMLElement).scrollWidth;
    });
  }

  async getGridCell(columnNameRegex: RegExp, fallbackCellIndex: number): Promise<Locator> {
    const row = this.page.locator('.ag-center-cols-container .ag-row').first();
    await this.ensureVisible(row, 20_000);
    const header = this.page.getByRole('columnheader', { name: columnNameRegex }).first();
    const headerVisible = await header.isVisible().catch(() => false);
    const ariaIndex = headerVisible ? await header.getAttribute('aria-colindex').catch(() => null) : null;
    if (ariaIndex) return row.locator(`[role="gridcell"][aria-colindex="${ariaIndex}"]`).first();
    return row.getByRole('gridcell').nth(fallbackCellIndex);
  }

  async editGridCellAndTab(columnNameRegex: RegExp, fallbackCellIndex: number, value: string): Promise<void> {
    const cell = await this.getGridCell(columnNameRegex, fallbackCellIndex);
    await this.activateGridCellForEdit(cell);

    const activeEditor = this.page
      .locator('.ag-cell-inline-editing input, .ag-cell-inline-editing textarea, .ag-cell-inline-editing [contenteditable="true"]')
      .first();
    if (await activeEditor.isVisible().catch(() => false)) {
      await activeEditor.click().catch(() => activeEditor.click({ force: true }));
    }

    await this.page.keyboard.press('Control+A').catch(() => {});
    await this.page.keyboard.type(value, { delay: 20 });
    await this.page.keyboard.press('Tab');
  }

  async editGridCellDirectAndTab(columnNameRegex: RegExp, fallbackCellIndex: number, value: string): Promise<void> {
    const cell = await this.getGridCell(columnNameRegex, fallbackCellIndex);
    const normalizedExpected = value.trim().toLowerCase();
    const readCellText = async (): Promise<string> => {
      const txt = (await cell.innerText().catch(() => '')) || '';
      return txt.replace(/\s+/g, ' ').trim().toLowerCase();
    };

    for (let attempt = 1; attempt <= 2; attempt += 1) {
      await this.ensureVisible(cell, 20_000);
      await cell.scrollIntoViewIfNeeded().catch(() => {});
      await this.clearBlockingUiArtifacts();
      await cell.click({ force: true });
      await this.page.keyboard.press('Control+A').catch(() => {});
      await this.page.keyboard.type(value, { delay: 20 });
      await this.page.keyboard.press('Tab');
      await this.page.waitForTimeout(200);

      const committedText = await readCellText();
      if (committedText.includes(normalizedExpected)) return;
    }

    throw new Error(`Failed to commit "${value}" in direct grid edit.`);
  }

  async blockUomSearchGlassIfVisible(): Promise<void> {
    const uomLookupDialog = this.page.locator(
      '.ui-dialog:has-text("UOM"), .ui-dialog:has-text("Unit"), [role="dialog"]:has-text("UOM"), [role="dialog"]:has-text("Unit")'
    ).first();
    const uomSearchGlass = this.page.locator(
      'img[id*="uom" i], button[id*="uom" i], a[id*="uom" i], [title*="uom" i], [aria-label*="uom" i]'
    ).first();

    const lookupVisible =
      (await uomLookupDialog.isVisible().catch(() => false)) || (await uomSearchGlass.isVisible().catch(() => false));

    if (!lookupVisible) return;

    await this.page.keyboard.press('Escape').catch(() => {});
    await this.page.locator('.ui-dialog-titlebar-close, button[aria-label="Close"]').first().click().catch(() => {});
    await uomLookupDialog.waitFor({ state: 'hidden', timeout: 3_000 }).catch(() => {});
  }

  // Step 3: Navigate to Purchasing > Special Order Items.
  async openSpecialOrderItemsFromSidebar(): Promise<void> {
    await this.ensureVisible(this.sidebarToggle, 20_000);
    await this.sidebarToggle.click();
    await this.ensureVisible(this.purchasingLink, 20_000);
    await this.purchasingLink.click();
    await this.ensureVisible(this.specialOrderItemsIcon, 20_000);
    await this.specialOrderItemsIcon.click();
    await this.page.waitForLoadState('domcontentloaded');
  }

  // Step 5: Ensure the first grid item is selected before Create PO.
  async selectFirstItemRow(): Promise<void> {
    const row = this.firstResultRow();
    await this.ensureVisible(row, 20_000);
    await row.scrollIntoViewIfNeeded().catch(() => {});
    await row.click({ force: true });

    const isSelected = async (): Promise<boolean> => {
      const cls = (await row.getAttribute('class').catch(() => '')) ?? '';
      return /\bag-row-selected\b/.test(cls);
    };

    if (!(await isSelected())) {
      await row.click({ force: true });
    }
  }

  // Step 4: Supplier selection helpers.
  async getSelectedSupplierValue(): Promise<string> {
    return (await this.supplierHiddenValueField.getAttribute('value').catch(() => null)) ?? '';
  }

  get sidebarToggle(): Locator { return this.page.locator('#sidebarToggle'); }
  get purchasingLink(): Locator { return this.page.getByTitle('Purchasing'); }
  get specialOrderItemsIcon(): Locator { return this.page.getByRole('img', { name: 'Special Order Items' }); }
  get selectSupplierButton(): Locator { return this.page.getByRole('button', { name: 'Select Supplier' }); }
  get formWindowIframe(): Locator { return this.page.locator('iframe[name="formWindow"]'); }
  get supplierHiddenValueField(): Locator { return this.page.locator('#FREEFORM_SUPPLIER_COMPANY_VALUE'); }
  // Step 5: Item grid and Create PO controls.
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
  get budgetGlAccountsDialog(): Locator {
    return this.page.locator('.ui-dialog:has-text("Budget GL Accounts"), [role="dialog"]:has-text("Budget GL Accounts")').first();
  }
  get glLookupFirstRow(): Locator {
    return this.budgetGlAccountsDialog.locator('td').filter({ hasText: /^\d{4}\.\d{6}$/ }).first();
  }
  get glLookupSelectButton(): Locator {
    return this.budgetGlAccountsDialog.getByRole('button', { name: 'Select', exact: true });
  }
  get supplierReturnButton(): Locator { return this.page.locator('#RetSupp').first(); }
  supplierCellInMainPopup(): Locator { return this.page.getByRole('cell', { name: /4 IMPRINT INC 14839|4 IMPRINT INC/i }).first(); }
  supplierTextInMainPopup(): Locator { return this.page.getByText(/4 IMPRINT INC 14839|4 IMPRINT INC/i).first(); }
  selectButtonGeneric(): Locator { return this.page.getByRole('button', { name: /^select$/i }).first(); }
  // Step 6 helpers: PO dialog iframe and fields.
  dialogIframeCandidates(): Locator[] {
    return [
      this.page.locator('iframe[name="_dlgOpenerIframe8"]'),
      this.page.locator('iframe[name="_dlgOpenerIframe7"]'),
      this.page.locator('iframe[name="_dlgOpenerIframe6"]'),
      this.page.locator('iframe[name="_dlgOpenerIframe5"]'),
      this.page.locator('iframe[name="_dlgOpenerIframe4"]'),
    ];
  }
  async getPoDialogFrame(timeoutMs = 30_000): Promise<FrameLocator> {
    const knownFrame = await this.firstVisible(this.dialogIframeCandidates(), Math.min(timeoutMs, 15_000)).catch(() => null);
    if (knownFrame) return knownFrame.contentFrame();

    const dynamicFrame = await this.findVisibleDialogIframe(timeoutMs);
    if (dynamicFrame) return dynamicFrame.contentFrame();

    const contentMatchedFrame = await this.findDialogIframeByContent(timeoutMs);
    if (contentMatchedFrame) return contentMatchedFrame.contentFrame();

    throw new Error('PO dialog iframe did not appear within timeout.');
  }
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
