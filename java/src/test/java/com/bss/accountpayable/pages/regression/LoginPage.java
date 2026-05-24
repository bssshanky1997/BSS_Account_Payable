package com.bss.accountpayable.pages.regression;

import com.bss.accountpayable.utils.Constants;
import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.options.AriaRole;
import com.microsoft.playwright.options.LoadState;

public class LoginPage {
  private final Page page;
  private final Locator loginId;
  private final Locator password;
  private final Locator subscriberId;
  private final Locator loginButton;

  public LoginPage(Page page) {
    this.page = page;
    this.loginId = page.locator("#loginID");
    this.password = page.locator("#password");
    this.subscriberId = page.locator("#subscriberID");
    this.loginButton = page.getByRole(AriaRole.BUTTON, new Page.GetByRoleOptions().setName("Login"));
  }

  public void navigate(String baseUrl) {
    page.navigate(
        baseUrl + Constants.Urls.J4_LOGIN,
        new Page.NavigateOptions().setTimeout(Constants.Timeouts.PAGE_LOAD));

    loginId.waitFor(new Locator.WaitForOptions().setTimeout(Constants.Timeouts.LONG));
    password.waitFor(new Locator.WaitForOptions().setTimeout(Constants.Timeouts.MEDIUM));
    subscriberId.waitFor(new Locator.WaitForOptions().setTimeout(Constants.Timeouts.MEDIUM));
    loginButton.waitFor(new Locator.WaitForOptions().setTimeout(Constants.Timeouts.LONG));
  }

  public Page login(String user, String pass, String subscriber) {
    loginId.waitFor(new Locator.WaitForOptions().setTimeout(Constants.Timeouts.MEDIUM));
    password.waitFor(new Locator.WaitForOptions().setTimeout(Constants.Timeouts.MEDIUM));
    subscriberId.waitFor(new Locator.WaitForOptions().setTimeout(Constants.Timeouts.MEDIUM));

    loginId.fill(user);
    password.fill(pass);
    subscriberId.fill(subscriber);

    Page popup =
        page.waitForPopup(
            new Page.WaitForPopupOptions().setTimeout(Constants.Timeouts.LONG),
            () -> loginButton.click());

    try {
      popup.waitForLoadState(
          LoadState.DOMCONTENTLOADED,
          new Page.WaitForLoadStateOptions().setTimeout(Constants.Timeouts.LONG));
    } catch (RuntimeException ignored) {
      // Continue if popup load-state settles differently.
    }

    Locator okButton =
        popup.getByRole(AriaRole.BUTTON, new Page.GetByRoleOptions().setName("OK"));
    okButton.waitFor(new Locator.WaitForOptions().setTimeout(Constants.Timeouts.LONG));
    okButton.click();

    try {
      popup.waitForTimeout(Constants.Timeouts.SHORT);
    } catch (RuntimeException ignored) {
      try {
        popup.waitForLoadState(LoadState.DOMCONTENTLOADED);
      } catch (RuntimeException ignoredAgain) {
        // Keep original page when popup is already done.
      }
    }

    return popup.isClosed() ? page : popup;
  }
}
