package com.bss.accountpayable.flows;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertFalse;

import com.bss.accountpayable.config.EnvConfig;
import com.bss.accountpayable.pages.regression.LoginPage;
import com.bss.accountpayable.utils.Constants;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.options.LoadState;
import java.util.regex.Pattern;

public final class LoginFlows {
  private LoginFlows() {}

  public static Page loginLandingPage(Page startPage) {
    EnvConfig env = EnvConfig.fromEnvironment();
    assertFalse(
        env.getUsername().isBlank() || env.getPassword().isBlank() || env.getSubscriberId().isBlank(),
        "Set USERNAME, PASSWORD, and SUBSCRIBER_ID as environment variables before running.");

    LoginPage loginPage = new LoginPage(startPage);
    Pattern j4LoginUrl = Constants.urlPathEndsWith(Constants.Urls.J4_LOGIN);

    loginPage.navigate(env.getBaseUrl());
    assertThat(startPage).hasURL(j4LoginUrl);

    Page appPage = loginPage.login(env.getUsername(), env.getPassword(), env.getSubscriberId());

    assertThat(appPage)
        .not()
        .hasURL(
            j4LoginUrl,
            new com.microsoft.playwright.assertions.PageAssertions.HasURLOptions()
                .setTimeout(Constants.Timeouts.PAGE_LOAD));
    assertThat(appPage)
        .hasURL(
            Pattern.compile("birchstreet", Pattern.CASE_INSENSITIVE),
            new com.microsoft.playwright.assertions.PageAssertions.HasURLOptions()
                .setTimeout(Constants.Timeouts.PAGE_LOAD));
    appPage.waitForLoadState(
        LoadState.NETWORKIDLE,
        new Page.WaitForLoadStateOptions().setTimeout(Constants.Timeouts.PAGE_LOAD));

    return appPage;
  }
}
