package com.bss.accountpayable.tests.regression;

import com.bss.accountpayable.fixtures.BaseUiTest;
import com.bss.accountpayable.flows.LoginFlows;
import com.bss.accountpayable.pages.regression.ApInvoicePage;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.options.LoadState;
import org.junit.jupiter.api.Test;

public class CreateNonPoInvoiceTest extends BaseUiTest {

  @Test
  void createAndSubmitApInvoiceAfterLoginLandingPage() {
    Page appPage = LoginFlows.loginLandingPage(page);
    ApInvoicePage invoice = new ApInvoicePage(appPage);
    String invoiceNumber =
        "IN" + String.valueOf(System.currentTimeMillis()).substring(String.valueOf(System.currentTimeMillis()).length() - 6);

    invoice.createInvoice();
    invoice.fillHeader(invoiceNumber, "535");
    invoice.addLineItem();
    invoice.fillSubtotal("125");
    invoice.saveInvoice();
    appPage.waitForLoadState(LoadState.NETWORKIDLE);
    invoice.submitInvoice();
  }
}
