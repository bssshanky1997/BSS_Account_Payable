package com.bss.accountpayable.tests.regression;

import com.bss.accountpayable.fixtures.BaseUiTest;
import com.bss.accountpayable.flows.LoginFlows;
import org.junit.jupiter.api.Test;

public class LoginLandingPageTest extends BaseUiTest {

  @Test
  void j4LoginReachesApplicationAfterPopupDismiss() {
    LoginFlows.loginLandingPage(page);
  }
}
