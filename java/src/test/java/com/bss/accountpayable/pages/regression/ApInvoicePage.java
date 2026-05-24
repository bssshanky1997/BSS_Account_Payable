package com.bss.accountpayable.pages.regression;

import com.microsoft.playwright.FrameLocator;
import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.options.AriaRole;

public class ApInvoicePage {
  private final Page page;
  private final FrameLocator frame;

  public ApInvoicePage(Page page) {
    this.page = page;
    this.frame = page.frameLocator("#jsp-frame");
  }

  private Locator quickLinks() {
    return page.locator("#quickLinks2");
  }

  private Locator apInvoiceBtn() {
    return page.getByRole(AriaRole.BUTTON, new Page.GetByRoleOptions().setName("AP Invoice"));
  }

  private Locator createInvoiceBtn() {
    return page.getByRole(
        AriaRole.BUTTON, new Page.GetByRoleOptions().setName("Create New Invoice"));
  }

  private Locator createFromScratch() {
    return page.locator("a.dropdown-item:has-text(\"Create From Scratch\")").first();
  }

  private Locator supplierInvoiceNumber() {
    return page.locator("#APINVOICE_HEADER-SUPPLIER_INVOICE_NUMBER");
  }

  private Locator invoiceDate() {
    return page.getByRole(AriaRole.TEXTBOX, new Page.GetByRoleOptions().setName("Invoice Date"));
  }

  private Locator supplierId() {
    return page.getByRole(AriaRole.TEXTBOX, new Page.GetByRoleOptions().setName("Supplier ID"));
  }

  private Locator addRow() {
    return page.getByRole(AriaRole.LINK, new Page.GetByRoleOptions().setName("+ Add Row"));
  }

  private Locator supplierSKU() {
    return frame.locator("#APINVOICE_DETAIL-SUPPLIER_SKU");
  }

  private Locator description() {
    return frame.locator("#APINVOICE_DETAIL-ITEM_DESCRIPTION");
  }

  private Locator departmentZoom() {
    return frame.locator("#department_zoom");
  }

  private Locator glAccountZoom() {
    return frame.locator("#gl_account_zoom");
  }

  private Locator qty() {
    return frame.locator("#APINVOICE_DETAIL-INVOICED_TOTAL_QTY");
  }

  private Locator price() {
    return frame.locator("#APINVOICE_DETAIL-INVOICE_UNIT_TRX_PRICE");
  }

  private Locator uom() {
    return frame.locator("#APINVOICE_DETAIL-INVOICE_UOM_CODE");
  }

  private Locator okButton() {
    return frame.getByRole(AriaRole.BUTTON, new FrameLocator.GetByRoleOptions().setName("OK"));
  }

  private Locator subTotal() {
    return page.locator("#APINVOICE_HEADER-PAPER_SUBTOTAL_TRX_AMT");
  }

  private Locator saveBtn() {
    return page.getByRole(AriaRole.BUTTON, new Page.GetByRoleOptions().setName("Save"));
  }

  private Locator submitBtn() {
    return page.getByRole(AriaRole.BUTTON, new Page.GetByRoleOptions().setName("Submit"));
  }

  public void createInvoice() {
    quickLinks().click();
    apInvoiceBtn().click();
    createInvoiceBtn().click();
    try {
      createFromScratch().waitFor(new Locator.WaitForOptions().setTimeout(15_000));
    } catch (RuntimeException e) {
      // Re-open menu if it collapses before selection.
      createInvoiceBtn().click();
      createFromScratch().waitFor(new Locator.WaitForOptions().setTimeout(15_000));
    }
    createFromScratch().click();
  }

  public void fillHeader(String invoiceNo, String supplier) {
    supplierInvoiceNumber().fill(invoiceNo);
    invoiceDate().fill("t");
    supplierId().fill(supplier);
  }

  public void addLineItem() {
    addRow().click();
    supplierSKU().fill("Test");
    description().fill("Testing");

    departmentZoom().click();
    frame.getByText("TCOS", new FrameLocator.GetByTextOptions().setExact(true)).click();
    frame.getByRole(AriaRole.BUTTON, new FrameLocator.GetByRoleOptions().setName("Select")).click();

    glAccountZoom().click();
    frame.locator("text=120700").first().click();
    frame.getByRole(AriaRole.BUTTON, new FrameLocator.GetByRoleOptions().setName("Select")).click();

    qty().fill("5");
    price().fill("25");
    uom().fill("EA");
    okButton().click();
  }

  public void fillSubtotal(String value) {
    subTotal().fill(value);
  }

  public void saveInvoice() {
    page.onDialog(dialog -> dialog.dismiss());
    saveBtn().click();
  }

  public void submitInvoice() {
    page.onDialog(dialog -> dialog.dismiss());
    submitBtn().click();
  }
}
