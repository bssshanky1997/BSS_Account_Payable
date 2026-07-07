import { test } from '../../fixtures/testFixture';
import { TaxAuthorityLevelPage } from '../../Page_Object_Model_Classes/Functional_Test/CD-5191_Tax Authority Level_Page.spec';

test.describe('CD-5191 Tax Authority Level', () => {
  test('should open AP home and switch to target company', async ({ page }) => {
    const taxAuthorityLevelPage = new TaxAuthorityLevelPage(page);
    const companyId = String(process.env.TARGET_COMPANY_ID || '931').trim();

    await taxAuthorityLevelPage.openHomeAndSwitchCompany(companyId);
    await taxAuthorityLevelPage.validateHomeLoaded();
  });
});
