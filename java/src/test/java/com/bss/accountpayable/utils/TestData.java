package com.bss.accountpayable.utils;

public final class TestData {
  private TestData() {}

  public record LoginCredentials(String username, String password, String subscriberId) {}

  public static LoginCredentials getValidCredentials() {
    return new LoginCredentials(
        getOrDefault("USERNAME", "testuser"),
        getOrDefault("PASSWORD", "TestPass123!"),
        getOrDefault("SUBSCRIBER_ID", "BSSQA"));
  }

  public static LoginCredentials getInvalidCredentials() {
    return new LoginCredentials("invaliduser", "WrongPassword!", "INVALID");
  }

  private static String getOrDefault(String key, String fallback) {
    String value = System.getenv(key);
    return value == null ? fallback : value;
  }
}
