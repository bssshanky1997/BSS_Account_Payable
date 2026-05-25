import { type Frame, type Locator, type Page } from '@playwright/test';
import { TIMEOUTS } from '../../utils/constants';
import { ensureAuthenticatedPage } from '../../utils/authSession';

type PageOrFrame = Page | Frame;

export class CD6242TaxFieldPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  private contexts(): PageOrFrame[] {
    return [this.page, ...this.page.frames()];
  }

  private async settle(ms = 500): Promise<void> {
    if (this.page.isClosed()) return;
    await this.page.waitForLoadState('domcontentloaded', { timeout: TIMEOUTS.MEDIUM }).catch(() => undefined);
    await this.page.waitForTimeout(ms).catch(() => undefined);
  }

  private async maximizeScreen(): Promise<void> {
    if (this.page.isClosed()) return;
    await this.page.setViewportSize({ width: 1280, height: 720 }).catch(() => undefined);
    await this.settle(200);
  }

  private async clickFirstVisible(context: PageOrFrame, candidates: Locator[]): Promise<boolean> {
    for (const locator of candidates) {
      try {
        if ((await locator.count()) <= 0) continue;
        const target = locator.first();
        await target.waitFor({ state: 'visible', timeout: 1200 }).catch(() => undefined);
        if (!(await target.isVisible())) continue;
        await target.click({ timeout: 1500 }).catch(async () => target.click({ timeout: 1500, force: true }));
        await this.settle(600);
        return true;
      } catch {
        // Keep trying.
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

  private async clickCreateNewInvoiceDropdown(): Promise<boolean> {
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

  private async clickCreateFromScratchOption(): Promise<boolean> {
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

  async openCreateInvoiceFromScratch(): Promise<void> {
    await ensureAuthenticatedPage(this.page, '/j4/default.jsp');
    await this.maximizeScreen();
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

    let createDropdownClicked = await this.clickCreateNewInvoiceDropdown();
    if (!createDropdownClicked) {
      await this.settle(500);
      createDropdownClicked = await this.clickCreateNewInvoiceDropdown();
    }

    let createScratchClicked = await this.clickCreateFromScratchOption();
    if (!createScratchClicked && createDropdownClicked) {
      await this.clickCreateNewInvoiceDropdown();
      createScratchClicked = await this.clickCreateFromScratchOption();
    }

    await this.page.waitForLoadState('networkidle', { timeout: TIMEOUTS.PAGE_LOAD }).catch(() => undefined);
    await this.settle(900);
    const smartApOpened = this.page.url().toLowerCase().includes('smartap.jsp');
    if (smartApOpened) createScratchClicked = true;

    if (!apInvoiceClicked) {
      throw new Error(
        `Unable to open AP Invoice from Quick Links. quick_links_clicked=${quickLinksClicked}, ap_invoice_clicked=${apInvoiceClicked}, page=${this.page.url()}`
      );
    }
    if (!createDropdownClicked || !createScratchClicked) {
      throw new Error(
        `Unable to open Create From Scratch from Create New Invoice dropdown. create_new_invoice_dropdown_clicked=${createDropdownClicked}, create_from_scratch_clicked=${createScratchClicked}, page=${this.page.url()}`
      );
    }
  }

  async validateAuxiliaryTaxFieldsVisible(): Promise<{
    allVisible: boolean;
    missing: string[];
    expectedCount: number;
    visibleCount: number;
  }> {
    const expectedFields: Array<[string, string, string[]]> = [
      ['Auxiliary Tax Amt 1', 'auxiliarytaxamt1', ['#APINVOICE_HEADER-AUX_TAX1_TRX_AMT']],
      ['Aux Code 1', 'auxcode1', ['#APINVOICE_HEADER-AUX_TAX1_GRP_CODE', '#APINVOICE_HEADER-AUX_TAX1_CODE']],
      ['Aux 1 Percent', 'aux1percent', ['#APINVOICE_HEADER-AUX_TAX1_TRX_AMT_PERCENT', '#APINVOICE_HEADER-AUX_TAX1_PERCENT']],
      ['Auxiliary Tax Amt 2', 'auxiliarytaxamt2', ['#APINVOICE_HEADER-AUX_TAX2_TRX_AMT']],
      ['Aux Code 2', 'auxcode2', ['#APINVOICE_HEADER-AUX_TAX2_GRP_CODE', '#APINVOICE_HEADER-AUX_TAX2_CODE']],
      ['Aux 2 Percent', 'aux2percent', ['#APINVOICE_HEADER-AUX_TAX2_TRX_AMT_PERCENT', '#APINVOICE_HEADER-AUX_TAX2_PERCENT']],
      ['Auxiliary Tax Amt 3', 'auxiliarytaxamt3', ['#APINVOICE_HEADER-AUX_TAX3_TRX_AMT']],
      ['Aux Code 3', 'auxcode3', ['#APINVOICE_HEADER-AUX_TAX3_GRP_CODE', '#APINVOICE_HEADER-AUX_TAX3_CODE']],
      ['Aux 3 Percent', 'aux3percent', ['#APINVOICE_HEADER-AUX_TAX3_TRX_AMT_PERCENT', '#APINVOICE_HEADER-AUX_TAX3_PERCENT']],
      ['Auxiliary Tax Amt 4', 'auxiliarytaxamt4', ['#APINVOICE_HEADER-AUX_TAX4_TRX_AMT']],
      ['Aux Code 4', 'auxcode4', ['#APINVOICE_HEADER-AUX_TAX4_GRP_CODE', '#APINVOICE_HEADER-AUX_TAX4_CODE']],
      ['Aux 4 Percent', 'aux4percent', ['#APINVOICE_HEADER-AUX_TAX4_TRX_AMT_PERCENT', '#APINVOICE_HEADER-AUX_TAX4_PERCENT']],
    ];

    const isVisibleScript = (token: string) => {
      const normalize = (value: string) => (value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const isVisible = (el: Element | null) => {
        if (!el) return false;
        const style = window.getComputedStyle(el as HTMLElement);
        if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity || '1') === 0) return false;
        const rect = (el as HTMLElement).getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      };
      const nodes = Array.from(document.querySelectorAll('label, span, div, td, th'));
      return nodes.some((el) => isVisible(el) && normalize(el.textContent || '').includes(token));
    };

    const missing: string[] = [];
    const hasVisibleMatch = async (context: PageOrFrame, selector: string): Promise<boolean> => {
      const locator = context.locator(selector);
      const count = await locator.count().catch(() => 0);
      for (let idx = 0; idx < count; idx += 1) {
        if (await locator.nth(idx).isVisible().catch(() => false)) return true;
      }
      return false;
    };

    for (const [label, token, selectors] of expectedFields) {
      let found = false;
      for (const context of this.contexts()) {
        if (await context.evaluate(isVisibleScript, token).catch(() => false)) {
          found = true;
          break;
        }
        for (const selector of selectors) {
          if (await hasVisibleMatch(context, selector)) {
            found = true;
            break;
          }
        }
        if (found) {
          found = true;
          break;
        }
      }
      if (!found) missing.push(label);
    }

    return {
      allVisible: missing.length === 0,
      missing,
      expectedCount: expectedFields.length,
      visibleCount: expectedFields.length - missing.length,
    };
  }

  async getNavigationDebugInfo(): Promise<{
    pageUrl: string;
    frameUrls: string[];
    sampleNavLabels: string[];
    frameClickables: Array<{ url: string; items: Array<Record<string, string>> }>;
  }> {
    const frameUrls = this.page.frames().map((frame) => frame.url());
    const sampleNavLabels = await this.page
      .evaluate(() =>
        Array.from(document.querySelectorAll("a, button, [role='link'], [role='button']"))
          .map((el) => (el.textContent || '').trim())
          .filter(Boolean)
          .slice(0, 40)
      )
      .catch(() => []);

    const diagnosticScript = () =>
      Array.from(document.querySelectorAll("a, button, [role='link'], [role='button'], li, span"))
        .map((el) => ({
          text: (el.textContent || '').trim(),
          href: el.getAttribute('href') || '',
          onclick: el.getAttribute('onclick') || '',
          id: (el as HTMLElement).id || '',
          cls: ((el as HTMLElement).className || '').toString(),
          title: el.getAttribute('title') || '',
        }))
        .filter((item) => /invoice|list|search|create|smart/i.test(`${item.text} ${item.href} ${item.onclick} ${item.id} ${item.cls} ${item.title}`))
        .slice(0, 80);

    const frameClickables: Array<{ url: string; items: Array<Record<string, string>> }> = [];
    for (const frame of this.page.frames()) {
      const items = await frame.evaluate(diagnosticScript).catch(() => []);
      frameClickables.push({ url: frame.url(), items });
    }

    return {
      pageUrl: this.page.url(),
      frameUrls: frameUrls.slice(0, 20),
      sampleNavLabels,
      frameClickables: frameClickables.slice(0, 5),
    };
  }
}

export const AttachmentNoteListPage = CD6242TaxFieldPage;
