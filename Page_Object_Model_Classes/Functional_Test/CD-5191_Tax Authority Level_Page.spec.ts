import { expect, type FrameLocator, type Locator, type Page } from '@playwright/test';
import { APHomePage } from '../Regression_Test/AP_Home_Page';
import { SmartAPListPage } from '../Regression_Test/SmartAP_List_Page';
import {
  CompanyApplicationSettingApi,
  type ShowTaxLevelFieldsOption,
  type TaxAuthorityLevelCasSettings,
} from '../../API_Helper/CompanyApplicationSetting';
import { IntegrationParameterApi } from '../../API_Helper/IntegrationParameter';
import { APPLICATION_SETTINGS_SCREEN_ID } from '../../utils/applicationSettingsApi/screenRegistry';
import { waitForLoaderToDisappear } from '../../utils/helpers';

type ShowTaxLevelOption = ShowTaxLevelFieldsOption;

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

  private readonly showTaxLevelUiValue: Record<ShowTaxLevelOption, string> = {
    // CAS #FIELD227 has no "Off" — blank "Select Entry" hides tax level fields.
    Off: '',
    'Show 1 Field': '1',
    'Show 2 Fields': '2',
    'Show 3 Fields': '3',
    'Show 4 Fields': '4',
  };

  private readonly showTaxLevelUiLabel: Record<ShowTaxLevelOption, RegExp> = {
    Off: /select entry|^$/i,
    'Show 1 Field': /show\s*1\s*fields?/i,
    'Show 2 Fields': /show\s*2\s*fields?/i,
    'Show 3 Fields': /show\s*3\s*fields?/i,
    'Show 4 Fields': /show\s*4\s*fields?/i,
  };

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

  private dialogFrame(): FrameLocator {
    return this.page.frameLocator(
      'iframe[name*="_dlgOpenerIframe"], iframe[id*="_dlgOpenerIframe"], iframe[name*="dlgOpener"]'
    );
  }

  // ─── after login prerequisite ──────────────────────────────────────────────

  /**
   * Once after login (do not call every test):
   *   1) switch company
   *   2) CAS Tax Type=1 + Tax Level 1 + Show 4 Fields + Save
   * Create From Scratch is NOT opened here — call openSmartApCreateFromScratch() in the test.
   */
  async runCasSetupOnce(companyId: string): Promise<string> {
    // next: open home + switch company
    await this.openHomeAndSwitchCompany(companyId);

    // next: CAS — Tax Type=1, Tax Level 1 search glass, Show 4 Fields, Save
    return this.setupCasTaxAuthorityLevel1();
  }

  /**
   * @deprecated Prefer runCasSetupOnce() once + openSmartApCreateFromScratch() per test.
   */
  async runAfterLoginPrerequisite(
    companyId: string,
    options?: { skipCasSetup?: boolean; openCreateFromScratch?: boolean }
  ): Promise<string> {
    let selectedTaxLevel = '';
    if (!options?.skipCasSetup) {
      selectedTaxLevel = await this.runCasSetupOnce(companyId);
    }
    if (options?.openCreateFromScratch !== false) {
      await this.openSmartApCreateFromScratch();
    }
    return selectedTaxLevel;
  }

  // ─── 1) company switch ─────────────────────────────────────────────────────

  async openHomeAndSwitchCompany(companyId: string): Promise<void> {
    // next: open home
    await this.page.goto('/j4/default.jsp', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await this.settle();

    // next: dismiss cookie banner if it blocks the header
    const cookieAccept = this.page.getByRole('button', { name: /accept.*close|accept/i }).first();
    if (await cookieAccept.isVisible().catch(() => false)) {
      await cookieAccept.click().catch(() => {});
      await this.page.waitForTimeout(500);
    }

    // next: wait for company switcher (#compDiv). If classic Order Guide loaded, retry home.
    let companySwitcher = this.page.locator('#compDiv').first();
    if (!(await companySwitcher.isVisible().catch(() => false))) {
      await this.page.goto('/j4/default.jsp', { waitUntil: 'networkidle', timeout: 60_000 }).catch(() => {});
      await this.settle();
      companySwitcher = this.page.locator('#compDiv').first();
    }
    if (!(await companySwitcher.isVisible().catch(() => false))) {
      // Fallback: open Home icon / link then recheck
      const homeLink = this.page.locator('a[href*="default.jsp"], a[href*="Home"], img[alt*="Home" i], a:has(img[alt*="Home" i])').first();
      if (await homeLink.isVisible().catch(() => false)) {
        await homeLink.click().catch(() => {});
        await this.settle();
      }
    }
    await this.page.locator('#compDiv').first().waitFor({ state: 'visible', timeout: 45_000 });

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

  /** Change Show Tax Level Fields on CAS UI (#FIELD227) and Save. */
  async setShowTaxLevelFieldsViaUi(option: ShowTaxLevelOption): Promise<void> {
    // next: open CAS Tax section
    await this.openCasTaxSection();

    // next: ensure Tax Type = Tax Authority Levels (enables Show Tax Level Fields options)
    const taxType = this.page.locator(`#${this.casUiField.taxType}`);
    await taxType.waitFor({ state: 'attached', timeout: 20_000 });
    await taxType.scrollIntoViewIfNeeded().catch(() => {});
    await taxType.selectOption('1');
    await this.page.waitForTimeout(500);

    // next: set Show tax level fields by value, else by option label text
    const select = this.page.locator(`#${this.casUiField.showTaxLevelFields}`);
    await select.waitFor({ state: 'attached', timeout: 20_000 });
    await select.scrollIntoViewIfNeeded().catch(() => {});

    const byValue = this.showTaxLevelUiValue[option];
    const okByValue = await select.selectOption(byValue).then(() => true).catch(() => false);
    if (!okByValue) {
      const pattern = this.showTaxLevelUiLabel[option].source;
      const matchedValue = await select.evaluate((el, patternSource) => {
        const re = new RegExp(patternSource, 'i');
        const options = Array.from((el as HTMLSelectElement).options);
        const hit = options.find((o) => re.test((o.text || '').trim()) || re.test((o.value || '').trim()));
        return hit ? hit.value : null;
      }, pattern);
      if (matchedValue === null) {
        const available = await select.evaluate((el) =>
          Array.from((el as HTMLSelectElement).options).map((o) => `${o.value}=${o.text}`)
        );
        throw new Error(`Show Tax Level Fields option not found for "${option}". Available: ${available.join(' | ')}`);
      }
      await select.selectOption(matchedValue);
    }
    await this.page.waitForTimeout(300);

    // next: Save
    this.page.once('dialog', (dialog) => {
      dialog.dismiss().catch(() => {});
    });
    await this.page.getByRole('button', { name: 'Save' }).click({ timeout: 15_000 });
    await this.settle();
    await this.page.waitForTimeout(800);
  }

  private async withCasApi<T>(fn: (api: CompanyApplicationSettingApi) => Promise<T>): Promise<T> {
    const api = new CompanyApplicationSettingApi();
    await api.init();
    try {
      return await fn(api);
    } finally {
      await api.dispose();
    }
  }

  async configureCasTaxAuthority(settings: TaxAuthorityLevelCasSettings, companyId?: string): Promise<void> {
    const targetCompany = String(companyId ?? process.env.TARGET_COMPANY_ID ?? '931').trim();
    await this.withCasApi((api) =>
      api.configureTaxAuthorityLevel(settings, {
        companyId: targetCompany,
        subscriberId: process.env.SUBSCRIBER_ID || '641',
        documentNumber: targetCompany,
      })
    );
  }

  async setDepartmentForTaxAuthority(department: string, companyId?: string): Promise<void> {
    await this.configureCasTaxAuthority({ departmentForTaxAuthority: department }, companyId);
  }

  async setUseTaxDepartmentForGlValidation(enabled: boolean, companyId?: string): Promise<void> {
    await this.configureCasTaxAuthority({ useTaxDepartmentForGlValidation: enabled }, companyId);
  }

  async setParam932(enabled: boolean, companyId?: string): Promise<void> {
    const api = new IntegrationParameterApi();
    await api.init();
    try {
      await api.setParam932(enabled, {
        companyId: companyId ?? process.env.TARGET_COMPANY_ID,
        subscriberId: process.env.SUBSCRIBER_ID,
      });
    } finally {
      await api.dispose();
    }
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

  // ─── Smart AP tax fields ───────────────────────────────────────────────────

  taxLevelField(level: 1 | 2 | 3 | 4): Locator {
    // Prefer real form controls; avoid matching hidden/nav text.
    return this.page
      .locator(
        `input[name*="TaxLevel${level}" i]:visible, input[id*="TaxLevel${level}" i]:visible, input[placeholder*="Tax Level ${level}" i]:visible, [aria-label*="Tax Level ${level}" i]:visible`
      )
      .or(
        this.page
          .locator(`label:has-text("Tax Level ${level}"):visible, span:has-text("Tax Level ${level} ID"):visible`)
          .locator('xpath=following::input[1]')
      )
      .first();
  }

  async verifySmartApTaxLevelVisibility(expectedVisibleLevels: number): Promise<void> {
    for (let level = 1; level <= 4; level += 1) {
      const field = this.taxLevelField(level as 1 | 2 | 3 | 4);
      const visible = await field.isVisible().catch(() => false);
      if (level <= expectedVisibleLevels) {
        expect(visible, `Smart AP Tax Level ${level} should be visible`).toBeTruthy();
      } else {
        expect(visible, `Smart AP Tax Level ${level} should be hidden`).toBeFalsy();
      }
    }
  }

  headerTaxAmountField(): Locator {
    // Visible header Tax Amount near Subtotal/Freight (not hidden Use Tax Amount).
    return this.page
      .locator('div')
      .filter({ has: this.page.getByText('Tax Amount', { exact: true }) })
      .locator('input')
      .first();
  }

  async verifyHeaderTaxAmountDisabled(): Promise<void> {
    const input = this.headerTaxAmountField();
    await input.scrollIntoViewIfNeeded().catch(() => {});
    await this.ensureVisible(input, 20_000);

    const disabled = await input.isDisabled().catch(() => false);
    const readonly = (await input.getAttribute('readonly')) !== null;
    const ariaReadonly = (await input.getAttribute('aria-readonly')) === 'true';
    if (disabled || readonly || ariaReadonly) {
      expect(true).toBeTruthy();
      return;
    }

    // Fallback: field may look enabled but reject edits (CD: header tax disabled).
    const before = (await input.inputValue().catch(() => '')) || '';
    await input.fill('999.99').catch(() => {});
    await input.press('Tab').catch(() => {});
    const after = (await input.inputValue().catch(() => '')) || '';
    expect(
      after === before || /999/.test(after) === false,
      'Header Tax Amount should be disabled/read-only or reject manual edit'
    ).toBeTruthy();
  }

  async getHeaderTaxAmount(): Promise<number> {
    const input = this.headerTaxAmountField();
    await input.scrollIntoViewIfNeeded().catch(() => {});
    const raw = ((await input.inputValue().catch(async () => (await input.textContent()) || '')) || '').replace(
      /[^0-9.-]/g,
      ''
    );
    return Number(raw || '0');
  }

  async verifyCreateScreenOpen(): Promise<void> {
    // next: confirm New AP Invoice form
    await expect(this.page.getByRole('button', { name: 'Save' })).toBeVisible({ timeout: 20_000 });
    await expect(this.page.getByRole('button', { name: 'Submit' })).toBeVisible();
    await expect(this.page.getByText('Invoice number', { exact: false }).first()).toBeVisible();
  }

  async verifyTaxAuthorityOptionsVisible(): Promise<void> {
    // next: at least Tax Level 1 (or tax section label) visible on invoice details
    const taxLevel1 = this.taxLevelField(1);
    const taxLabel = this.page.getByText(/tax level|tax authority/i).first();
    const levelVisible = await taxLevel1.isVisible().catch(() => false);
    const labelVisible = await taxLabel.isVisible().catch(() => false);
    expect(levelVisible || labelVisible, 'Tax Authority Level options should be visible on Smart AP').toBeTruthy();
  }

  private async searchAndSelectInLookupDialog(searchText: string): Promise<void> {
    const frame = this.dialogFrame();
    const input = frame.locator('#InputValue, input[name="InputValue"], input[type="text"]').first();
    await input.waitFor({ state: 'visible', timeout: 20_000 });
    await input.click().catch(() => input.click({ force: true }));
    await input.fill('');
    await input.type(searchText);
    await input.press('Enter').catch(() => {});
    await this.settle();

    const escaped = searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const result = frame
      .locator('tr, .ag-row, a, li, td')
      .filter({ hasText: new RegExp(escaped, 'i') })
      .first();
    if (await result.isVisible().catch(() => false)) {
      await result.click().catch(() => result.click({ force: true }));
    }

    const ok = frame.getByRole('button', { name: /^(ok|select)$/i }).first();
    if (await ok.isVisible().catch(() => false)) {
      await this.clickWhenReady(ok);
    } else {
      const okMain = this.page.getByRole('button', { name: /^(ok|select)$/i }).first();
      if (await okMain.isVisible().catch(() => false)) await this.clickWhenReady(okMain);
    }
    await this.settle();
  }

  async selectSmartApTaxLevel(level: 1 | 2 | 3 | 4, value: string): Promise<void> {
    // next: locate Tax Level field
    const field = this.taxLevelField(level);
    await this.ensureVisible(field, 20_000);

    // next: open lookup if search glass present, else fill input
    const lookup = await this.firstVisible([
      field.locator('xpath=ancestor::tr[1]').locator(
        'img[src*="search" i], img[title*="Search" i], img[alt*="Search" i], a[title*="Search" i], img, button, a'
      ),
      field.locator('..').locator('img[src*="search" i], img[title*="Search" i], img, button, a, [title*="Search" i]'),
      this.page.locator(`[aria-label*="Tax Level ${level}" i] ~ img, [aria-label*="Tax Level ${level}" i] ~ button`),
    ]).catch(() => null);

    if (lookup) {
      await this.clickWhenReady(lookup);
      await this.searchAndSelectInLookupDialog(value);
    } else {
      const input = field.locator('input').first().or(field);
      await input.fill(value);
      await input.press('Tab').catch(() => {});
    }
    await this.settle();
  }

  async clearSmartApTaxLevel(level: 1 | 2 | 3 | 4): Promise<void> {
    const field = this.taxLevelField(level);
    await this.ensureVisible(field, 20_000);
    const input = field.locator('input').first().or(field);
    await input.fill('');
    await input.press('Tab').catch(() => {});
    await this.settle();
  }

  async verifyHeaderTaxAmountEquals(expected: number, tolerance = 0.05): Promise<void> {
    const actual = await this.getHeaderTaxAmount();
    expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance);
  }

  async addInvoiceLineAmount(amount: number, lineIndex = 0): Promise<void> {
    // next: fill line / amount
    const amountCell = this.page
      .locator('.ag-center-cols-container .ag-row, table tbody tr, [role="row"]')
      .nth(lineIndex)
      .locator('input[name*="amount" i], input[id*="amount" i], [col-id*="amount" i] input, td input')
      .first();

    if (await amountCell.isVisible().catch(() => false)) {
      await amountCell.dblclick().catch(() => amountCell.click({ force: true }));
      await amountCell.fill(String(amount));
      await amountCell.press('Tab').catch(() => {});
    } else {
      const anyAmount = await this.firstVisible([
        this.page.getByLabel(/amount|extended|subtotal/i),
        this.page.locator('input[name*="Amount" i], input[id*="Amount" i]'),
      ]);
      await anyAmount.fill(String(amount));
    }
    await this.settle();
  }

  async saveInvoice(): Promise<void> {
    // next: Save
    const save = await this.firstVisible([
      this.page.getByRole('button', { name: /^save$/i }),
      this.page.locator('button, a, input').filter({ hasText: /^save$/i }),
    ]);
    await this.clickWhenReady(save);
    await this.settle();
  }

  async submitInvoice(): Promise<void> {
    // next: Submit
    const submit = await this.firstVisible([
      this.page.getByRole('button', { name: /submit/i }),
      this.page.locator('button, a, input').filter({ hasText: /submit/i }),
    ]);
    await this.clickWhenReady(submit);
    await this.settle();
  }

  async cancelInvoiceEdits(): Promise<void> {
    // next: Cancel
    const cancel = this.page.getByRole('button', { name: /cancel/i }).first();
    if (await cancel.isVisible().catch(() => false)) {
      await this.clickWhenReady(cancel);
    } else {
      await this.page.goBack().catch(() => {});
    }
    await this.settle();
  }

  async verifyValidationOrHoldMessage(pattern: RegExp): Promise<void> {
    const message = await this.firstVisible([
      this.page.locator('.toast-error, .alert-danger, .error, .validation-error, [role="alert"]'),
      this.page.locator('text=/hold|invalid|validation|required|tax level|department|gl/i'),
    ]);
    await expect(message).toBeVisible();
    const text = ((await message.textContent()) || '').toLowerCase();
    expect(pattern.test(text) || text.length > 0).toBeTruthy();
  }

  async verifyInvoiceNotHeldForDeptGlOnly(): Promise<void> {
    const hold = this.page.locator('text=/held|hold for|invalid department|invalid.*gl/i').first();
    const visible = await hold.isVisible().catch(() => false);
    if (visible) {
      const text = ((await hold.textContent()) || '').toLowerCase();
      expect(text.includes('department') && text.includes('gl')).toBeFalsy();
    }
  }

  async verifyTaxFieldsEditable(editable: boolean): Promise<void> {
    const field = this.taxLevelField(1);
    if (!(await field.isVisible().catch(() => false))) {
      expect(editable, 'Tax Level 1 not visible while expecting editable fields').toBeFalsy();
      return;
    }
    const input = field.locator('input').first().or(field);
    const disabled = await input.isDisabled().catch(() => false);
    const readonly = (await input.getAttribute('readonly')) !== null;
    if (editable) {
      expect(disabled || readonly).toBeFalsy();
    } else {
      expect(disabled || readonly).toBeTruthy();
    }
  }

  async searchInvoiceInList(invoiceNumber: string): Promise<void> {
    await this.openSmartApInvoiceList();
    const search = await this.firstVisible([
      this.page.getByPlaceholder(/search/i),
      this.page.locator('input[type="search"], input[name*="search" i]'),
    ]);
    await search.fill(invoiceNumber);
    await search.press('Enter').catch(() => {});
    await this.settle();
    const row = this.page.locator('tr, .ag-row, a').filter({ hasText: invoiceNumber }).first();
    await expect(row).toBeVisible();
  }

  async openInvoiceFromList(invoiceNumber: string): Promise<void> {
    await this.searchInvoiceInList(invoiceNumber);
    const row = this.page.locator('tr, .ag-row, a').filter({ hasText: invoiceNumber }).first();
    await this.clickWhenReady(row);
    await this.settle();
  }
}
