import { test, expect } from '../../fixtures/testFixture';
import { TaxAuthorityLevelPage } from '../../Page_Object_Model_Classes/Functional_Test/CD-5191_Tax Authority Level_Page.spec';

/**
 * CD-5191 — Smart AP Tax Authority Level
 *
 * Form (after login):
 *   Company .............. TARGET_COMPANY_ID (default 931)
 *   Tax Type ............. 1 (Tax Authority Levels)
 *   Tax Level 1 .......... first row via search glass
 *   Show tax level fields  4
 *   Smart AP ............. Create New Invoice → Create From Scratch
 */
test.describe('CD-5191 Tax Authority Level', () => {
  const companyId = String(process.env.TARGET_COMPANY_ID || '931').trim();

  let taxPage: TaxAuthorityLevelPage;
  /** CAS setup once per worker; later tests only reopen Create From Scratch. */
  let casTaxAuthorityPrerequisiteDone = false;

  test.beforeEach(async ({ page }) => {
    test.setTimeout(180_000);
    taxPage = new TaxAuthorityLevelPage(page);

    // next: after login — company switch + CAS (once) + Create From Scratch
    const selected = await taxPage.runAfterLoginPrerequisite(companyId, {
      skipCasSetup: casTaxAuthorityPrerequisiteDone,
    });

    if (!casTaxAuthorityPrerequisiteDone) {
      expect(selected).toBeTruthy();
      casTaxAuthorityPrerequisiteDone = true;
    }
  });

  test('TC-13: Prerequisite opens New AP Invoice create screen', async ({ page }) => {
    // next: verify New AP Invoice form is open
    await expect(page.getByRole('button', { name: 'Save' })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('button', { name: 'Submit' })).toBeVisible();
    await expect(page.getByText('Invoice number', { exact: false }).first()).toBeVisible();

    // next: fill Invoice number
    // next: fill Invoice Date
    // next: select Vendor / Supplier
    // next: select Tax Level 1-4 (as needed)
    // next: add line amount
    // next: Save / Submit
  });
});
