package com.bss.accountpayable.config;

public final class EnvConfig {
  private final String baseUrl;
  private final String username;
  private final String password;
  private final String subscriberId;
  private final String apiBaseUrl;
  private final int timeout;

  private EnvConfig(
      String baseUrl,
      String username,
      String password,
      String subscriberId,
      String apiBaseUrl,
      int timeout) {
    this.baseUrl = baseUrl;
    this.username = username;
    this.password = password;
    this.subscriberId = subscriberId;
    this.apiBaseUrl = apiBaseUrl;
    this.timeout = timeout;
  }

  public static EnvConfig fromEnvironment() {
    String timeoutValue = System.getenv("TIMEOUT");
    int parsedTimeout = 30000;
    if (timeoutValue != null && !timeoutValue.isBlank()) {
      try {
        parsedTimeout = Integer.parseInt(timeoutValue);
      } catch (NumberFormatException ignored) {
        parsedTimeout = 30000;
      }
    }

    return new EnvConfig(
        getOrDefault("BASE_URL", "https://appqa.birchstreet.co"),
        getOrDefault("USERNAME", ""),
        getOrDefault("PASSWORD", ""),
        getOrDefault("SUBSCRIBER_ID", ""),
        getOrDefault("API_BASE_URL", "https://qa-api.birchstreet.net"),
        parsedTimeout);
  }

  private static String getOrDefault(String key, String fallback) {
    String value = System.getenv(key);
    return value == null ? fallback : value;
  }

  public String getBaseUrl() {
    return baseUrl;
  }

  public String getUsername() {
    return username;
  }

  public String getPassword() {
    return password;
  }

  public String getSubscriberId() {
    return subscriberId;
  }

  public String getApiBaseUrl() {
    return apiBaseUrl;
  }

  public int getTimeout() {
    return timeout;
  }
}
