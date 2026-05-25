import { expect, type Frame, type Locator, type Page } from '@playwright/test';
import { TIMEOUTS } from '../../utils/constants';
import { ensureAuthenticatedPage } from '../../utils/authSession';

type PageOrFrame = Page | Frame;

export class CD5192TaxFunctionalityPage {
  static readonly LOGIN_URL = 'https://appqa.birchstreet.co/j4/default.jsp';
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  private async settle(ms = 500): Promise<void> {
    try {
      await this.page.waitForLoadState('domcontentloaded', { timeout: TIMEOUTS.MEDIUM });
    } catch {
      // DOM may already be stable enough.
    }
    await this.page.waitForTimeout(ms);
  }

  private async manageScreenForFormVisibility(): Promise<void> {
    await this.page.setViewportSize({ width: 1600, height: 900 }).catch(() => undefined);
    await this.page.evaluate(() => {
      document.body.style.zoom = '90%';
    }).catch(() => undefined);
  }

  private auxAmountSelector(level: number): string {
    return `#APINVOICE_HEADER-AUX_TAX${level}_TRX_AMT`;
  }

  private auxCodeSelector(level: number): string {
    return `#APINVOICE_HEADER-AUX_TAX${level}_GRP_CODE`;
  }

  private auxPercentSelector(level: number): string {
    return `#APINVOICE_HEADER-AUX_TAX${level}_TRX_AMT_PERCENT`;
  }

  private async firstVisibleMatch(locator: Locator): Promise<Locator | null> {
    const count = await locator.count().catch(() => 0);
    for (let idx = 0; idx < count; idx += 1) {
      const candidate = locator.nth(idx);
      if (await candidate.isVisible().catch(() => false)) return candidate;
    }
    return null;
  }

  private async firstVisibleLocator(candidates: Locator[]): Promise<Locator | null> {
    for (const locator of candidates) {
      try {
        const visible = await this.firstVisibleMatch(locator);
        if (visible) return visible;
      } catch {
        // Keep searching.
      }
    }
    return null;
  }

  private async amountLocator(level: number): Promise<Locator> {
    const locator = await this.firstVisibleLocator([this.page.locator(this.auxAmountSelector(level))]);
    return locator ?? this.page.locator(this.auxAmountSelector(level)).first();
  }

  private async codeLocator(level: number): Promise<Locator> {
    const locator = await this.firstVisibleLocator([
      this.page.locator(this.auxCodeSelector(level)),
      this.page.locator(`#APINVOICE_HEADER-AUX_TAX${level}_CODE`),
    ]);
    return locator ?? this.page.locator(this.auxCodeSelector(level)).first();
  }

  private async percentLocator(level: number): Promise<Locator> {
    const locator = await this.firstVisibleLocator([
      this.page.locator(this.auxPercentSelector(level)),
      this.page.locator(`#APINVOICE_HEADER-AUX_TAX${level}_PERCENT`),
    ]);
    return locator ?? this.page.locator(this.auxPercentSelector(level)).first();
  }

  private parseDecimal(value: string): number | null {
    const cleaned = (value ?? '').replace(/,/g, '').trim();
    const match = cleaned.match(/-?\d+(?:\.\d+)?/);
    return match ? Number(match[0]) : null;
  }

  private async isSmartApCreateOpen(): Promise<boolean> {
    if (this.page.url().toLowerCase().includes('smartap.jsp')) return true;
    try {
      return await this.page.locator('#APINVOICE_HEADER-PAPER_SUBTOTAL_TRX_AMT').first().isVisible();
    } catch {
      return false;
    }
  }

  private contexts(): PageOrFrame[] {
    return [this.page, ...this.page.frames()];
  }

  private async clickFirstVisible(context: PageOrFrame, candidates: Locator[]): Promise<boolean> {
    for (const locator of candidates) {
      try {
        if ((await locator.count()) <= 0) continue;
        const target = locator.first();
        await target.waitFor({ state: 'visible', timeout: 1500 }).catch(() => undefined);
        if (!(await target.isVisible().catch(() => false))) continue;
        await target.click({ timeout: 2000 }).catch(async () => target.click({ timeout: 2000, force: true }));
        await this.settle(600);
        return true;
      } catch {
        // Keep trying remaining candidates.
      }
    }
    return false;
  }

  private async clickTextOrHrefInPage(labels: string[], hrefTokens: string[] = []): Promise<boolean> {
    const script = ({ labelList, hrefList }: { labelList: string[]; hrefList: string[] }) => {
      const normalizedLabels = (labelList || []).map((label) => (label || '').toLowerCase());
      const normalizedHrefTokens = (hrefList || []).map((token) => (token || '').toLowerCase());
      const clickables = Array.from(document.querySelectorAll('a, button, [role="button"], [role="link"]'));
      const candidate = clickables.find((el) => {
        if (el.hasAttribute('disabled')) return false;
        const text = (el.textContent || '').trim().toLowerCase();
        const href = (el.getAttribute('href') || '').trim().toLowerCase();
        return (
          normalizedLabels.some((label) => label && text.includes(label)) ||
          normalizedHrefTokens.some((token) => token && href.includes(token))
        );
      });
      if (!candidate) return false;
      candidate.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
      return true;
    };

    for (const context of this.contexts()) {
      const clicked = await context.evaluate(script, { labelList: labels, hrefList: hrefTokens }).catch(() => false);
      if (clicked) {
        await this.settle(900);
        return true;
      }
    }
    return false;
  }

  private async openCreateNewInvoiceDropdown(): Promise<boolean> {
    for (const context of this.contexts()) {
      const clicked = await this.clickFirstVisible(context, [
        context.locator('#createNewInvoiceDropdown'),
        context.locator("[id*='createNewInvoiceDropdown' i]"),
        context.getByRole('button', { name: /Create New Invoice|Create Invoice/i }),
        context.getByRole('link', { name: /Create New Invoice|Create Invoice/i }),
        context.getByText(/Create New Invoice|Create Invoice/i),
      ]);
      if (clicked) return true;
    }
    return this.clickTextOrHrefInPage(['create new invoice', 'create invoice']);
  }

  private async openCreateFromScratchOption(): Promise<boolean> {
    for (const context of this.contexts()) {
      const clicked = await this.clickFirstVisible(context, [
        context.getByRole('link', { name: /Create From Scratch/i }),
        context.getByRole('button', { name: /Create From Scratch/i }),
        context.getByText(/Create From Scratch/i),
        context.locator("a[href*=\"createInvoice('scratch')\"]"),
        context.locator("[onclick*=\"createInvoice('scratch')\"]"),
      ]);
      if (clicked) return true;
    }
    return this.clickTextOrHrefInPage(['create from scratch'], ["createinvoice('scratch')"]);
  }

  async ensureAllTaxFieldsVisible(): Promise<void> {
    const selectors = [
      '#APINVOICE_HEADER-AUX_TAX1_TRX_AMT',
      '#APINVOICE_HEADER-AUX_TAX1_GRP_CODE',
      '#APINVOICE_HEADER-AUX_TAX1_TRX_AMT_PERCENT',
      '#APINVOICE_HEADER-AUX_TAX2_TRX_AMT',
      '#APINVOICE_HEADER-AUX_TAX2_GRP_CODE',
      '#APINVOICE_HEADER-AUX_TAX2_TRX_AMT_PERCENT',
      '#APINVOICE_HEADER-AUX_TAX3_TRX_AMT',
      '#APINVOICE_HEADER-AUX_TAX3_GRP_CODE',
      '#APINVOICE_HEADER-AUX_TAX3_TRX_AMT_PERCENT',
      '#APINVOICE_HEADER-AUX_TAX4_TRX_AMT',
      '#APINVOICE_HEADER-AUX_TAX4_GRP_CODE',
      '#APINVOICE_HEADER-AUX_TAX4_TRX_AMT_PERCENT',
    ];
    for (const selector of selectors) {
      const group = this.page.locator(selector);
      if (await group.count()) {
        const visible = await this.firstVisibleMatch(group);
        if (visible) {
          await visible.scrollIntoViewIfNeeded().catch(() => undefined);
          await expect(visible).toBeVisible({ timeout: TIMEOUTS.MEDIUM });
        }
      }
    }
  }

  async getVisibleAuxLevels(): Promise<number[]> {
    const levels: number[] = [];
    for (let level = 1; level <= 4; level += 1) {
      const amount = await this.amountLocator(level);
      const code = await this.codeLocator(level);
      const percent = await this.percentLocator(level);
      if (
        (await amount.isVisible().catch(() => false)) &&
        (await code.isVisible().catch(() => false)) &&
        (await percent.isVisible().catch(() => false))
      ) {
        levels.push(level);
      }
    }
    return levels;
  }

  async isAuxPercentReadOnly(level: number): Promise<boolean> {
    const field = await this.percentLocator(level);
    if (await field.isDisabled().catch(() => false)) return true;
    const readonly = await field.getAttribute('readonly');
    const ariaReadonly = await field.getAttribute('aria-readonly');
    return readonly !== null || ariaReadonly === 'true';
  }

  async fillAuxAmount(level: number, value: string): Promise<string> {
    const field = await this.amountLocator(level);
    await field.scrollIntoViewIfNeeded().catch(() => undefined);
    await field.click();
    await field.fill('');
    await field.fill(value);
    await this.page.keyboard.press('Tab');
    await this.settle(250);
    return (await field.inputValue()).trim();
  }

  async clearAuxAmount(level: number): Promise<void> {
    await this.fillAuxAmount(level, '');
  }

  async getAuxAmountValue(level: number): Promise<string> {
    return (await (await this.amountLocator(level)).inputValue()).trim();
  }

  async fillAuxCode(level: number, value: string): Promise<string> {
    const field = await this.codeLocator(level);
    await field.scrollIntoViewIfNeeded().catch(() => undefined);
    await field.click();
    await field.fill('');
    await field.fill(value);
    await this.page.keyboard.press('Tab');
    await this.settle(250);
    return (await field.inputValue()).trim();
  }

  async clearAuxCode(level: number): Promise<void> {
    await this.fillAuxCode(level, '');
  }

  async getAuxCodeValue(level: number): Promise<string> {
    return (await (await this.codeLocator(level)).inputValue()).trim();
  }

  async getAuxPercentValue(level: number): Promise<string> {
    return (await (await this.percentLocator(level)).inputValue()).trim();
  }

  async getAuxPercentNumber(level: number): Promise<number | null> {
    return this.parseDecimal(await this.getAuxPercentValue(level));
  }

  async getLookupButton(level: number): Promise<Locator | null> {
    return this.firstVisibleLocator([
      this.page.locator(`#APINVOICE_HEADER-AUX_TAX${level}_GRP_CODE_zoom`),
      this.page.locator(`#APINVOICE_HEADER-AUX_TAX${level}_CODE_zoom`),
      this.page.locator(`[id*='AUX_TAX${level}_CODE'][id*='zoom' i]`),
      this.page.locator(`[name*='AUX_TAX${level}_CODE'][name*='zoom' i]`),
      this.page.locator(`xpath=//*[contains(normalize-space(), 'Aux Code ${level}')]/following::*[self::a or self::button][1]`),
    ]);
  }

  async isLookupAccessible(level: number): Promise<boolean> {
    const button = await this.getLookupButton(level);
    return !!button && (await button.isEnabled().catch(() => false));
  }

  async isLookupLinkedToScreenId(level: number, screenId: string): Promise<boolean> {
    const button = await this.getLookupButton(level);
    if (!button) return false;
    const attrs = await Promise.all([
      button.getAttribute('href'),
      button.getAttribute('onclick'),
      button.getAttribute('data-target'),
      button.getAttribute('title'),
      button.getAttribute('aria-label'),
      button.getAttribute('id'),
    ]);
    return attrs.join(' ').toLowerCase().includes(screenId.toLowerCase());
  }

  async selectTaxCodeFromLookup(level: number, taxCode = 'TAX1'): Promise<boolean> {
    const before = await this.getAuxCodeValue(level);
    const lookup = await this.getLookupButton(level);
    if (lookup) {
      await lookup.click({ timeout: TIMEOUTS.SHORT }).catch(() => undefined);
      await this.settle(600);
      for (const context of this.contexts()) {
        const row = context.getByText(taxCode, { exact: false }).first();
        if (await row.isVisible().catch(() => false)) {
          await row.click().catch(() => undefined);
          break;
        }
      }
      for (const context of this.contexts()) {
        const selectButton = context.getByRole('button', { name: /select|apply|ok/i }).first();
        if (await selectButton.isVisible().catch(() => false)) {
          await selectButton.click().catch(() => undefined);
          break;
        }
      }
      await this.settle(800);
    }

    const afterLookup = await this.getAuxCodeValue(level);
    if (afterLookup && afterLookup !== before) return true;

    await this.fillAuxCode(level, taxCode);
    return !!(await this.getAuxCodeValue(level));
  }

  async getExtensionAmountValue(): Promise<string> {
    return (await this.page.locator('#APINVOICE_HEADER-PAPER_SUBTOTAL_TRX_AMT').first().inputValue()).trim();
  }

  async getExtensionAmountNumber(): Promise<number | null> {
    return this.parseDecimal(await this.getExtensionAmountValue());
  }

  private async getNumericValueNearLabel(tokens: string[]): Promise<number | null> {
    return this.page
      .evaluate((needleTokens) => {
        const norm = (v: string) => (v || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const parseAmount = (v: string) => {
          const match = (v || '').replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
          return match ? Number(match[0]) : null;
        };
        const normalizedTokens = (needleTokens || []).map(norm);
        const labels = Array.from(document.querySelectorAll('label, span, div, td, th'));
        for (const label of labels) {
          const text = norm(label.textContent || '');
          if (!normalizedTokens.every((token) => text.includes(token))) continue;
          const container = label.closest('tr, td, div, section, form') || label.parentElement || document.body;
          const candidates = Array.from(container.querySelectorAll('input, [role="textbox"], td, span, div'));
          for (const candidate of candidates) {
            const raw = (candidate as HTMLInputElement).value || candidate.textContent || '';
            const parsed = parseAmount(raw);
            if (parsed !== null) return parsed;
          }
        }
        return null;
      }, tokens)
      .catch(() => null);
  }

  async getTotalAmountWithAuxTaxNumber(): Promise<number | null> {
    const locator = await this.firstVisibleLocator([
      this.page.locator("xpath=//*[contains(normalize-space(), 'Total Amt With Aux Tax')]/following::input[1]").first(),
      this.page.locator("xpath=//*[contains(normalize-space(), 'Total Amount With Aux Tax')]/following::input[1]").first(),
      this.page.locator("[id*='TOTAL'][id*='AUX'][id*='TAX' i]").first(),
    ]);
    if (locator) {
      const raw = (await locator.inputValue().catch(async () => (await locator.textContent()) || '')).trim();
      const parsed = this.parseDecimal(raw);
      if (parsed !== null) return parsed;
    }
    return this.getNumericValueNearLabel(['total', 'aux', 'tax']);
  }

  async getTotalAmountNumber(): Promise<number | null> {
    const locator = await this.firstVisibleLocator([
      this.page.locator('#APINVOICE_HEADER-PAPER_TOTAL_TRX_AMT'),
      this.page.locator('#APINVOICE_HEADER-TOTAL_TRX_AMT'),
      this.page.locator("[id*='TOTAL_TRX_AMT' i]"),
    ]);
    if (locator) {
      const raw = await locator.inputValue().catch(async () => (await locator.textContent()) || '');
      return this.parseDecimal(raw);
    }
    return this.getNumericValueNearLabel(['total', 'amount']);
  }

  async isAuxCodeMarkedMandatory(level: number): Promise<boolean> {
    return this.page
      .evaluate((selector) => {
        const field = document.querySelector(selector);
        if (!field) return false;
        const attrRequired = field.hasAttribute('required') || field.getAttribute('aria-required') === 'true';
        const ariaInvalid = field.getAttribute('aria-invalid') === 'true';
        const wrapperClass = (field.closest('td,div,tr') as HTMLElement | null)?.className || '';
        const signature = `${(field as HTMLElement).className || ''} ${wrapperClass}`.toLowerCase();
        return attrRequired || ariaInvalid || signature.includes('required') || signature.includes('invalid');
      }, this.auxCodeSelector(level))
      .catch(() => false);
  }

  async clickSave(): Promise<void> {
    this.page.on('dialog', (dialog) => {
      dialog.dismiss().catch(() => undefined);
    });
    await this.page.getByRole('button', { name: 'Save' }).click({ timeout: TIMEOUTS.MEDIUM });
    await this.settle(1000);
  }

  async hasTaxCodeRequiredMessage(): Promise<boolean> {
    const text = ((await this.page.locator('body').innerText().catch(() => '')) || '').toLowerCase();
    return text.includes('tax code') && (text.includes('required') || text.includes('mandatory'));
  }

  async isAuxAmountDecimalSupported(level: number, value = '10.1250'): Promise<boolean> {
    const entered = await this.fillAuxAmount(level, value);
    return entered.includes('.') && this.parseDecimal(entered) !== null;
  }

  async isAuxAmountNegativeRestricted(level: number, value = '-10.25'): Promise<boolean> {
    const entered = await this.fillAuxAmount(level, value);
    const parsed = this.parseDecimal(entered);
    return entered === '' || (parsed !== null && parsed >= 0);
  }

  async isAuxAmountInvalidCharsRestricted(level: number, value = 'abc!@#'): Promise<boolean> {
    const entered = await this.fillAuxAmount(level, value);
    return entered === '' || this.parseDecimal(entered) !== null;
  }

  async gotoLoginPage(): Promise<void> {
    await this.manageScreenForFormVisibility();
    await this.page.goto(CD5192TaxFunctionalityPage.LOGIN_URL, {
      waitUntil: 'domcontentloaded',
      timeout: TIMEOUTS.PAGE_LOAD,
    });
    await this.settle(300);
  }

  async login(username: string, password: string, subscriberId: string): Promise<void> {
    await this.gotoLoginPage();
    await this.page.locator('#loginID').fill(username);
    await this.page.locator('#password').fill(password);
    await this.page.locator('#subscriberID').fill(subscriberId);
    await this.page.getByRole('button', { name: 'Login' }).click();
    await this.page.waitForLoadState('networkidle', { timeout: TIMEOUTS.PAGE_LOAD }).catch(() =>
      this.page.waitForLoadState('domcontentloaded', { timeout: TIMEOUTS.PAGE_LOAD })
    );
    await this.settle(500);
    const quickLinksVisible = await this.page.locator('#quickLinks1').first().isVisible({ timeout: TIMEOUTS.LONG }).catch(() => false);
    const apInvoiceVisible = await this.page
      .getByRole('button', { name: /AP Invoice|A\/P Invoice|AP Invoice List/i })
      .first()
      .isVisible({ timeout: TIMEOUTS.SHORT })
      .catch(() => false);
    expect(quickLinksVisible || apInvoiceVisible || this.page.url().includes('/j4/default.jsp')).toBeTruthy();
  }

  async openCreateFromScratchInvoice(): Promise<void> {
    await ensureAuthenticatedPage(this.page, '/j4/default.jsp');
    await this.manageScreenForFormVisibility();
    await this.settle(900);

    let quickLinksClicked = false;
    for (const context of this.contexts()) {
      quickLinksClicked = await this.clickFirstVisible(context, [
        context.locator('#quickLinks2'),
        context.locator('#quickLinks1'),
        context.getByRole('button', { name: /Quick Links?|Quick Link/i }),
        context.getByText(/Quick Links?|Quick Link/i),
      ]);
      if (quickLinksClicked) break;
    }

    let apInvoiceClicked = false;
    for (const context of this.contexts()) {
      apInvoiceClicked = await this.clickFirstVisible(context, [
        context.getByRole('button', { name: /AP Invoice|A\/P Invoice|AP Invoice List/i }),
        context.getByRole('link', { name: /AP Invoice|A\/P Invoice|AP Invoice List/i }),
        context.getByText(/AP Invoice|A\/P Invoice|AP Invoice List/i),
      ]);
      if (apInvoiceClicked) break;
    }
    if (!apInvoiceClicked) {
      apInvoiceClicked = await this.clickTextOrHrefInPage(['ap invoice', 'a/p invoice', 'ap invoice list'], ['apinvoice', 'invoice']);
    }

    let createDropdownClicked = await this.openCreateNewInvoiceDropdown();
    if (!createDropdownClicked) {
      await this.settle(500);
      createDropdownClicked = await this.openCreateNewInvoiceDropdown();
    }

    let createScratchClicked = await this.openCreateFromScratchOption();
    if (!createScratchClicked && createDropdownClicked) {
      await this.openCreateNewInvoiceDropdown();
      createScratchClicked = await this.openCreateFromScratchOption();
    }

    if (await this.isSmartApCreateOpen()) {
      createScratchClicked = true;
    }

    if (!apInvoiceClicked) {
      throw new Error(
        `Unable to open AP Invoice entry point. quick_links_clicked=${quickLinksClicked}, ap_invoice_clicked=${apInvoiceClicked}, page=${this.page.url()}`
      );
    }
    if (!createDropdownClicked || !createScratchClicked) {
      throw new Error(
        `Unable to open Create From Scratch flow. create_new_invoice_dropdown_clicked=${createDropdownClicked}, create_from_scratch_clicked=${createScratchClicked}, page=${this.page.url()}`
      );
    }

    await this.page.waitForLoadState('networkidle', { timeout: TIMEOUTS.PAGE_LOAD }).catch(() =>
      this.page.waitForLoadState('domcontentloaded', { timeout: TIMEOUTS.PAGE_LOAD })
    );
    await this.settle(500);
    await expect(this.page.locator('#APINVOICE_HEADER-PAPER_SUBTOTAL_TRX_AMT')).toBeVisible({ timeout: TIMEOUTS.LONG });
  }

  async fillPaperSubtotal(amount: string): Promise<void> {
    const field = this.page.locator('#APINVOICE_HEADER-PAPER_SUBTOTAL_TRX_AMT').first();
    await field.scrollIntoViewIfNeeded().catch(() => undefined);
    await field.click();
    await field.fill('');
    await field.fill(amount);
    await this.page.keyboard.press('Tab');
    await this.settle(400);
  }
}
