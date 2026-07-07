import { expect, type Locator, type Page } from '@playwright/test';

export class ReceivingPOPage {
  constructor(private readonly page: Page) {}

  private async ensureVisible(locator: Locator, timeoutMs = 20_000): Promise<void> {
    await locator.waitFor({ state: 'visible', timeout: timeoutMs });
  }

  private async waitForScreenLoad(targetPage: Page, timeoutMs = 25_000): Promise<void> {
    await targetPage.waitForLoadState('domcontentloaded', { timeout: timeoutMs }).catch(() => {});
    await targetPage.waitForLoadState('networkidle', { timeout: timeoutMs }).catch(() => {});
    await targetPage.locator('body').first().waitFor({ state: 'visible', timeout: timeoutMs }).catch(() => {});
  }

  private async clickWhenReady(locator: Locator, timeoutMs = 20_000): Promise<void> {
    await this.ensureVisible(locator, timeoutMs);
    await expect(locator).toBeEnabled({ timeout: timeoutMs });
    await locator.click().catch(() => locator.click({ force: true }));
  }

  private async firstVisible(candidates: Locator[], timeoutMs = 20_000, waitPage: Page = this.page): Promise<Locator> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (waitPage.isClosed()) {
        throw new Error('Page closed while waiting for receiving element.');
      }
      for (const candidate of candidates) {
        const count = await candidate.count().catch(() => 0);
        for (let i = 0; i < count; i += 1) {
          const node = candidate.nth(i);
          if (await node.isVisible().catch(() => false)) return node;
        }
      }
      await waitPage.waitForTimeout(150);
    }
    throw new Error('Receiving element was not visible within timeout.');
  }

  //step 1: Open Manage Order with created PO number.
  async openManageOrderForPo(poNumber: string): Promise<void> {
    await this.page
      .goto(`/j4/Home1.jsp?contentUrl=agfrontpage_UI4.jsp?screenid=5&isIncludedFromHome=1&loaddata=${poNumber}`)
      .catch(() => {});
    await this.waitForScreenLoad(this.page);
    await this.ensureVisible(this.page.locator('.ag-center-cols-container, [role="grid"]').first(), 20_000).catch(() => {});
  }

  poGridCell(poNumber: string): Locator {
    return this.page.getByRole('gridcell', { name: new RegExp(poNumber, 'i') }).first();
  }

  firstResultRow(): Locator {
    return this.page.locator('.ag-center-cols-container .ag-row').first();
  }

  async selectPoRow(poNumber: string): Promise<void> {
    await this.waitForScreenLoad(this.page);
    const rowCell = this.poGridCell(poNumber);
    if (await rowCell.isVisible().catch(() => false)) {
      await this.clickWhenReady(rowCell, 20_000);
      return;
    }

    const fallbackRow = this.firstResultRow();
    await this.clickWhenReady(fallbackRow, 20_000);
  }

  receivingButtonCandidates(): Locator[] {
    return [
      this.page.getByRole('button', { name: /^receiv(?:e|ing)$/i }),
      this.page.getByRole('button', { name: /receiv(?:e|ing)/i }),
      this.page.locator('#Receiving, #receive, #btnReceive, [id*="receiv" i]'),
      this.page.locator('button:has-text("Receiving"), button:has-text("Receive")'),
    ];
  }

  receiveConfirmButtonCandidates(): Locator[] {
    return [
      this.page.getByRole('button', { name: /^receive$/i }),
      this.page.getByRole('button', { name: /^ok$/i }),
      this.page.getByRole('button', { name: /^yes$/i }),
      this.page.locator('button:has-text("Receive"), button:has-text("OK"), button:has-text("Yes")'),
      this.page.locator('#btnReceive, #receive, #ok'),
    ];
  }

  async clickReceivingButton(): Promise<void> {
    const receivingButton = await this.firstVisible(this.receivingButtonCandidates(), 25_000);
    await this.clickWhenReady(receivingButton, 25_000);
    await this.page.waitForTimeout(500);
  }

  private async waitForReceivingPage(timeoutMs = 25_000): Promise<Page> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const pages = this.page.context().pages();
      for (const p of pages) {
        if (p.isClosed()) continue;
        await this.waitForScreenLoad(p, 5_000);
        const receivingMarkers = [
          p.locator('text=/^Receiving\\s*-/i').first(),
          p.locator('text=/Buyer\\s*PO\\s*\\/\\s*Receiving/i').first(),
          p.locator('xpath=//*[contains(normalize-space(.),"Received date")]').first(),
          p.getByRole('tab', { name: /line\\s*items/i }).first(),
        ];
        let isReceivingScreen = false;
        for (const marker of receivingMarkers) {
          if (await marker.isVisible().catch(() => false)) {
            isReceivingScreen = true;
            break;
          }
        }
        if (isReceivingScreen) return p;
      }
      await this.page.waitForTimeout(250).catch(() => {});
    }
    throw new Error('Receiving page with FIELD22 was not visible within timeout.');
  }

  private async waitForField22OnPage(receivingPage: Page, timeoutMs = 12_000): Promise<boolean> {
    const deadline = Date.now() + timeoutMs;
    const field22Candidates = this.receivedDateFieldCandidates(receivingPage);
    while (Date.now() < deadline) {
      if (receivingPage.isClosed()) return false;
      for (const field22 of field22Candidates) {
        if (await field22.isVisible().catch(() => false)) return true;
      }
      const receivingDetailSignals = [
        receivingPage.locator('text=/^Receiving\\s*-/i').first(),
        receivingPage.getByRole('tab', { name: /line\\s*items/i }).first(),
        receivingPage.getByRole('button', { name: /^receive$/i }).first(),
      ];
      for (const signal of receivingDetailSignals) {
        if (await signal.isVisible().catch(() => false)) return true;
      }
      await receivingPage.waitForTimeout(200).catch(() => {});
    }
    return false;
  }

  async openReceivingScreenFromBuyerPo(): Promise<Page> {
    //step 2: Open Receiving screen from selected PO.
    // Retry Receive click when Receiving screen opens in a separate page context.
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      await this.clickReceivingButton();
      const receivingPage = await this.waitForReceivingPage(8_000).catch(() => null);
      if (receivingPage) return receivingPage;
      await this.page.waitForTimeout(1_500);
    }

    return this.waitForReceivingPage(25_000);
  }

  async ensureReceivingDetailPage(receivingPage: Page, poNumber: string): Promise<void> {
    await this.waitForScreenLoad(receivingPage);
    if (await this.waitForField22OnPage(receivingPage, 2_000)) return;

    const poRow = receivingPage.getByRole('gridcell', { name: new RegExp(poNumber, 'i') }).first();
    if (await poRow.isVisible().catch(() => false)) {
      await poRow.click().catch(() => poRow.click({ force: true }));
      await receivingPage.waitForTimeout(300);
    }

    const openReceiveButton = await this.firstVisible(
      [
        receivingPage.getByRole('button', { name: /^receive$/i }),
        receivingPage.locator('#btnReceive, #receive'),
        receivingPage.locator('button:has-text("Receive"):not(:has-text("Invoice"))'),
      ],
      20_000,
      receivingPage
    );
    await this.clickWhenReady(openReceiveButton, 20_000);
    await this.waitForScreenLoad(receivingPage);

    const detailReady = await this.waitForField22OnPage(receivingPage, 20_000);
    if (!detailReady) {
      throw new Error('Receiving detail form did not open with Received date field.');
    }
  }

  receivedDateFieldCandidates(receivingPage: Page): Locator[] {
    return [
      receivingPage.locator('#FIELD22'),
      receivingPage.locator('[id*="FIELD22" i], [name*="FIELD22" i]'),
      receivingPage.frameLocator('iframe[name*="_dlgOpenerIframe"]').locator('#FIELD22'),
      receivingPage.frameLocator('iframe[name*="_dlgOpenerIframe"]').locator('[id*="FIELD22" i], [name*="FIELD22" i]'),
      receivingPage.locator('xpath=//*[contains(normalize-space(.),"Received date")]/ancestor::tr[1]//input[not(@type="hidden")][1]'),
      receivingPage.locator('xpath=//*[contains(normalize-space(.),"Received date")]/following::input[not(@type="hidden")][1]'),
      receivingPage
        .locator('tr, div, label')
        .filter({ hasText: /received\\s*date/i })
        .locator('input:not([type="hidden"])')
        .first(),
      receivingPage.locator('#receivedDate, #ReceivedDate, #RECEIVEDDATE, [id*="receiveddate" i]'),
      receivingPage.locator('input[name*="receiveddate" i], input[id*="receiptdate" i], input[name*="receiptdate" i]'),
      receivingPage.locator('label:has-text("Received date")').locator('xpath=following::input[1]'),
      receivingPage.locator('text=/^Received\\s*date$/i').locator('xpath=following::input[1]'),
      receivingPage.getByLabel(/received\s*date/i),
      receivingPage.getByPlaceholder(/received\s*date/i),
      receivingPage.locator('input[aria-label*="received date" i]'),
    ];
  }

  linkItemsTabCandidates(): Locator[] {
    return [
      this.page.getByRole('tab', { name: /link\s*items/i }),
      this.page.getByRole('tab', { name: /line\s*items/i }),
      this.page.getByRole('link', { name: /link\s*items/i }),
      this.page.getByRole('link', { name: /line\s*items/i }),
      this.page.locator('a:has-text("Line items"), button:has-text("Line items")'),
      this.page.locator('[role="tab"]:has-text("Link Items"), a:has-text("Link Items"), button:has-text("Link Items")'),
      this.page.locator('#linkItems, #LinkItems, [id*="linkitems" i]'),
    ];
  }

  receiveAcceptAllCheckboxCandidates(receivingPage: Page): Locator[] {
    return [
      receivingPage.getByLabel(/receive\s*accept\s*all/i),
      receivingPage
        .locator('tr, div, label')
        .filter({ hasText: /receive\s*accept\s*all/i })
        .locator('input[type="checkbox"]'),
      receivingPage.locator('input[type="checkbox"][id*="accept" i], input[type="checkbox"][name*="accept" i]'),
      receivingPage.locator('xpath=//*[contains(normalize-space(.),"Receive Accept All")]/preceding::input[@type="checkbox"][1]'),
    ];
  }

  receiveButtonOnReceivingPageCandidates(receivingPage: Page): Locator[] {
    return [
      receivingPage.getByRole('button', { name: /^receive$/i }),
      receivingPage.locator('#btnReceive, #receive'),
      receivingPage.locator('button:has-text("Receive"):not(:has-text("Invoice"))'),
    ];
  }

  async fillReceivedDateAndOpenLinkItems(receivingPage: Page): Promise<void> {
    await this.waitForScreenLoad(receivingPage);
    const field22 = await this.firstVisible(this.receivedDateFieldCandidates(receivingPage), 25_000, receivingPage);
    await this.ensureVisible(field22, 20_000);
    await this.clickWhenReady(field22, 20_000);
    await field22.press('Control+A').catch(() => {});
    await field22.fill('t').catch(async () => {
      await field22.type('t');
    });

    // Commit typed value by clicking outside on receiving screen.
    await receivingPage.locator('body').click({ position: { x: 10, y: 10 } }).catch(() => {});
    await receivingPage.waitForTimeout(500);

    const linkItemsTab = await this.firstVisible(
      [
        receivingPage.getByRole('tab', { name: /link\s*items/i }),
        receivingPage.getByRole('tab', { name: /line\s*items/i }),
        receivingPage.getByRole('link', { name: /link\s*items/i }),
        receivingPage.getByRole('link', { name: /line\s*items/i }),
        receivingPage.locator('a:has-text("Line items"), button:has-text("Line items")'),
        receivingPage.locator('[role="tab"]:has-text("Link Items"), a:has-text("Link Items"), button:has-text("Link Items")'),
      ],
      20_000,
      receivingPage
    );
    await this.clickWhenReady(linkItemsTab, 20_000);
    await this.waitForScreenLoad(receivingPage);
  }

  async clickReceiveAcceptAllAndReceive(receivingPage: Page): Promise<void> {
    await this.waitForScreenLoad(receivingPage);
    const receiveAcceptAllCheckbox = await this.firstVisible(
      this.receiveAcceptAllCheckboxCandidates(receivingPage),
      20_000,
      receivingPage
    );
    await this.ensureVisible(receiveAcceptAllCheckbox, 20_000);
    if (!(await receiveAcceptAllCheckbox.isChecked().catch(() => false))) {
      await this.clickWhenReady(receiveAcceptAllCheckbox, 20_000);
    }

    const receiveButton = await this.firstVisible(this.receiveButtonOnReceivingPageCandidates(receivingPage), 20_000, receivingPage);
    await this.ensureVisible(receiveButton, 20_000);
    await this.clickWhenReady(receiveButton, 20_000);
  }

  async confirmReceivingIfPrompted(actionPage: Page): Promise<void> {
    // Some environments show browser dialogs on receive action.
    actionPage.once('dialog', dialog => {
      dialog.accept().catch(() => {});
    });

    const confirmButton = await this.firstVisible(
      [
        actionPage.getByRole('button', { name: /^receive$/i }),
        actionPage.getByRole('button', { name: /^ok$/i }),
        actionPage.getByRole('button', { name: /^yes$/i }),
        actionPage.locator('button:has-text("Receive"), button:has-text("OK"), button:has-text("Yes")'),
        actionPage.locator('#btnReceive, #receive, #ok'),
      ],
      10_000
    ).catch(() => null);
    if (!confirmButton) return;
    await this.clickWhenReady(confirmButton, 10_000);
  }

  private async waitForReceivingPageToCloseIfPopup(receivingPage: Page, timeoutMs = 15_000): Promise<void> {
    if (receivingPage === this.page) return;
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (receivingPage.isClosed()) return;
      await this.page.waitForTimeout(250).catch(() => {});
    }
  }

  private async ensurePoStatusMovedToReceivingCompleted(poNumber: string): Promise<void> {
    await this.page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
    await this.page.waitForLoadState('networkidle').catch(() => {});

    await expect
      .poll(
        async () => {
          const poCell = this.poGridCell(poNumber);
          if (!(await poCell.isVisible().catch(() => false))) return '';
          const row = poCell.locator('xpath=ancestor::*[@role="row"][1]');
          return ((await row.innerText().catch(() => '')) || '').replace(/\s+/g, ' ').trim().toLowerCase();
        },
        { timeout: 60_000, intervals: [1_000, 2_000, 3_000] }
      )
      .toMatch(/receiv|rec['’`]?d|partially\s*rec|fully\s*rec/i);
  }

  async receivePoFromManageOrder(poNumber: string): Promise<void> {
    await this.openManageOrderForPo(poNumber);
    await this.selectPoRow(poNumber);
    const receivingPage = await this.openReceivingScreenFromBuyerPo();
    await this.ensureReceivingDetailPage(receivingPage, poNumber);
    await this.page.waitForTimeout(1_000);
    await this.fillReceivedDateAndOpenLinkItems(receivingPage);
    await this.clickReceiveAcceptAllAndReceive(receivingPage);
    await this.page.waitForTimeout(800);
    await this.confirmReceivingIfPrompted(receivingPage);
    await this.page.waitForTimeout(2_500);
    await this.waitForReceivingPageToCloseIfPopup(receivingPage);
    await this.page.bringToFront().catch(() => {});
    await this.ensurePoStatusMovedToReceivingCompleted(poNumber);
  }
}
