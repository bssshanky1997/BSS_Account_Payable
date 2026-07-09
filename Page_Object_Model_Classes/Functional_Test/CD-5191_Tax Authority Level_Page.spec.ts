import { expect, type Locator, type Page } from '@playwright/test';
import { APHomePage } from '../Regression_Test/AP_Home_Page';
import { SmartAPListPage } from '../Regression_Test/SmartAP_List_Page';
import { APPLICATION_SETTINGS_SCREEN_ID } from '../../utils/applicationSettingsApi/screenRegistry';
import { waitForLoaderToDisappear } from '../../utils/helpers';

/**
 * CD-5191 Tax Authority Level — Page Object
 *
 * Form (after login):
 *   Company .............. TARGET_COMPANY_ID (default 931)
 *   Tax Type ............. #FIELD199 = 1 (Tax Authority Levels)
 *   Tax Level 1 .......... #zoom_FIELD213 → first row → Select
 *   Show tax level fields  #FIELD227 = 4
 *   Smart AP ............. Create New Invoice → Create From Scratch
 */
export class TaxAuthorityLevelPage {
  private readonly apHomePage: APHomePage;
  private readonly smartAPListPage: SmartAPListPage;

  // CAS UI field ids (screen 10292)
  private readonly casUiField = {
    taxType: 'FIELD199',
    taxLevel1Zoom: 'zoom_FIELD213',
    showTaxLevelFields: 'FIELD227',
  } as const;

  constructor(private readonly page: Page) {
    this.apHomePage = new APHomePage(page);
    this.smartAPListPage = new SmartAPListPage(page);
  }

  // ─── helpers ───────────────────────────────────────────────────────────────

  private async settle(): Promise<void> {
    await waitForLoaderToDisappear(this.page);
    await this.page.waitForLoadState('domcontentloaded').catch(() => {});
    await this.page.waitForLoadState('networkidle').catch(() => {});
  }

  private async ensureVisible(locator: Locator, timeoutMs = 20_000): Promise<void> {
    await locator.waitFor({ state: 'visible', timeout: timeoutMs });
  }

  private async clickWhenReady(locator: Locator, timeoutMs = 20_000): Promise<void> {
    await waitForLoaderToDisappear(this.page);
    await this.ensureVisible(locator, timeoutMs);
    await expect(locator).toBeEnabled({ timeout: timeoutMs });
    await locator.click().catch(() => locator.click({ force: true }));
  }

  private async firstVisible(candidates: Locator[], timeoutMs = 20_000): Promise<Locator> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      for (const candidate of candidates) {
        const count = await candidate.count().catch(() => 0);
        for (let i = 0; i < count; i += 1) {
          const node = candidate.nth(i);
          if (await node.isVisible().catch(() => false)) return node;
        }
      }
      await this.page.waitForTimeout(150);
    }
    throw new Error('Visible element not found for requested action.');
  }

  // ─── after login prerequisite (single entry) ───────────────────────────────

  /**
   * After login:
   *   1) switch company
   *   2) CAS Tax Authority setup (once)
   *   3) Smart AP Create From Scratch
   */
  async runAfterLoginPrerequisite(companyId: string, options?: { skipCasSetup?: boolean }): Promise<string> {
    // next: open home + switch company
    await this.openHomeAndSwitchCompany(companyId);

    let selectedTaxLevel = '';
    if (!options?.skipCasSetup) {
      // next: CAS — Tax Type=1, Tax Level 1 search glass, Show 4 Fields, Save
      selectedTaxLevel = await this.setupCasTaxAuthorityLevel1();
    }

    // next: Smart AP list → Create New Invoice → Create From Scratch
    await this.openSmartApCreateFromScratch();

    return selectedTaxLevel;
  }

  // ─── 1) company switch ─────────────────────────────────────────────────────

  async openHomeAndSwitchCompany(companyId: string): Promise<void> {
    // next: open home
    await this.page.goto('/j4/default.jsp', { waitUntil: 'domcontentloaded' });

    // next: switch company via APHomePage (#compDiv)
    await this.apHomePage.changeCompanyId(companyId);

    // next: wait until setCompID.jsp redirect settles
    await this.page.waitForURL((url) => !/setCompID\.jsp/i.test(url.pathname), { timeout: 45_000 }).catch(() => {});
    await this.settle();
    await this.page.locator('#compDiv').first().waitFor({ state: 'visible', timeout: 20_000 }).catch(() => {});
    await this.page.waitForTimeout(1500);

    // next: confirm home loaded
    await expect(this.page.locator('#compDiv')).toBeVisible();
  }

  // ─── 2) CAS Tax Authority setup ────────────────────────────────────────────

  async openCompanyApplicationSettings(): Promise<void> {
    // next: open CAS screen 10292
    const screenId = APPLICATION_SETTINGS_SCREEN_ID.companyApplicationSetting;
    await this.page.waitForLoadState('domcontentloaded').catch(() => {});
    await this.page.goto(`/j4/agscreen.jsp?screenid=${screenId}`, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    });
    await this.settle();
  }

  async openCasTaxSection(): Promise<void> {
    // next: open CAS
    await this.openCompanyApplicationSettings();

    // next: search Tax section (if search box present)
    const search = await this.firstVisible([
      this.page.getByPlaceholder(/search/i),
      this.page.locator('input[type="search"], input[name*="search" i], #searchText, #txtSearch'),
    ]).catch(() => null);

    if (search) {
      await search.fill('Tax');
      await search.press('Enter').catch(() => {});
      await this.settle();
    }
  }

  /**
   * CAS codegen flow:
   *   Tax Type = 1
   *   Tax Level 1 via #zoom_FIELD213 → first row → Select
   *   Show tax level fields = 4
   *   Save
   */
  async setupCasTaxAuthorityLevel1(): Promise<string> {
    // next: open CAS Tax section
    await this.openCasTaxSection();

    // next: Tax Type = 1 (Tax Authority Levels)
    await this.page.locator(`#${this.casUiField.taxType}`).selectOption('1');
    await this.page.waitForTimeout(500);

    // next: Tax Level 1 search glass
    await this.page.locator(`#${this.casUiField.taxLevel1Zoom}`).click();
    await this.page.waitForTimeout(500);

    // next: select first grid row (value "1")
    const firstCell = this.page.getByRole('gridcell', { name: '1', exact: true }).first();
    await firstCell.waitFor({ state: 'visible', timeout: 20_000 });
    const selected = ((await firstCell.innerText().catch(() => '')) || '1').trim() || '1';
    await firstCell.click();

    // next: click Select
    await this.page.getByRole('button', { name: 'Select' }).click();
    await this.page.waitForTimeout(500);

    // next: Show tax level fields = 4
    await this.page.locator(`#${this.casUiField.showTaxLevelFields}`).selectOption('4');
    await this.page.waitForTimeout(300);

    // next: Save (dismiss any dialog)
    this.page.once('dialog', (dialog) => {
      dialog.dismiss().catch(() => {});
    });
    await this.page.getByRole('button', { name: 'Save' }).click({ timeout: 15_000 });
    await this.page.waitForLoadState('domcontentloaded').catch(() => {});
    await waitForLoaderToDisappear(this.page).catch(() => {});
    await this.page.waitForTimeout(1000);

    return selected;
  }

  // ─── 3) Smart AP Create From Scratch ───────────────────────────────────────

  async openSmartApInvoiceList(): Promise<void> {
    // next: open home
    await this.page.goto('/j4/default.jsp');
    await this.settle();

    // next: Accounts Payable Quick Links → AP Invoice
    await this.smartAPListPage.openApInvoiceFromQuickLinks();
    await this.settle();
  }

  async openSmartApCreateFromScratch(): Promise<void> {
    // next: open AP Invoice list
    await this.openSmartApInvoiceList();

    // next: Create New Invoice
    const createNew = await this.firstVisible([
      this.page.getByRole('button', { name: /create new invoice/i }),
      this.page.getByRole('link', { name: /create new invoice/i }),
      this.page.locator('button, a, span').filter({ hasText: /create new invoice/i }),
    ]);
    await this.clickWhenReady(createNew);

    // next: Create From Scratch
    const fromScratch = await this.firstVisible([
      this.page.getByRole('button', { name: /create from scratch/i }),
      this.page.getByRole('link', { name: /create from scratch/i }),
      this.page.locator('button, a, span, li').filter({ hasText: /create from scratch/i }),
    ]);
    await this.clickWhenReady(fromScratch);
    await this.settle();
  }
}
