import { test } from '../fixtures/testFixture';
import { APHomePage } from '@poms/AP_Home_Page';

test.describe('SmartAp Detail Page', () => {
  test('Create invoice from scratch in Smart AP detail', async ({ page }) => {
    const apHomePage = new APHomePage(page);
    const companyId = String(process.env.TARGET_COMPANY_ID || '931').trim();

    await test.step('Open AP Home page and navigate to AP Invoice', async () => {
      await apHomePage.openHomePage();
      await apHomePage.changeCompanyId(companyId);
      await apHomePage.openApInvoicePage();
    });

    await test.step('Fill Smart AP invoice detail form and save', async () => {
      await apHomePage.createInvoiceFromScratch({
        invoiceNumber: '45678987',
        invoiceDate: 't',
        supplierName: 'IMPRINT INC',
        supplierSku: 'Test',
        itemDescription: 'Testing',
        departmentName: 'QAAUTO2020',
        glAccount: '1400.345340',
        quantity: '5',
        unitPrice: '50',
        uomCode: 'EA',
        taxCode: 'TAX CODE 10',
        subTotal: '250',
        taxAmount: '25',
      });
      await apHomePage.saveInvoiceDismissDialog();
      await apHomePage.openInvoiceDetailUrl(
        'https://appqa.birchstreet.co/j4/Home1.jsp?contentUrl=%2FSmartAP.jsp%3FisEdit%3Dfalse%26apInvoiceNumber%3D026155I00009907%26D%3D1782804115387&isIncludedFromHome=1&D=1782803869622&isEdit=false'
      );
    });
  });
});
