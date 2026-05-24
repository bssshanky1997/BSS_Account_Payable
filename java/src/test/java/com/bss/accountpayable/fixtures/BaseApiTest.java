package com.bss.accountpayable.fixtures;

import com.bss.accountpayable.utils.ApiHelper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;

public abstract class BaseApiTest {
  protected ApiHelper apiHelper;

  @BeforeEach
  void apiSetUp() {
    apiHelper = new ApiHelper();
    apiHelper.init();
  }

  @AfterEach
  void apiTearDown() {
    if (apiHelper != null) {
      apiHelper.dispose();
    }
  }
}
