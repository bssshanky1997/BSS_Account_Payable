package com.bss.accountpayable.utils;

import com.bss.accountpayable.config.EnvConfig;
import com.microsoft.playwright.APIRequest;
import com.microsoft.playwright.APIRequestContext;
import com.microsoft.playwright.APIResponse;
import com.microsoft.playwright.Playwright;
import com.microsoft.playwright.options.RequestOptions;
import java.util.HashMap;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class ApiHelper {
  private final Playwright playwright;
  private APIRequestContext apiContext;
  private final String baseUrl;
  private String authToken = "";

  public ApiHelper() {
    this.playwright = Playwright.create();
    this.baseUrl = EnvConfig.fromEnvironment().getApiBaseUrl();
  }

  public void init() {
    APIRequest request = playwright.request();
    Map<String, String> headers = new HashMap<>();
    headers.put("Content-Type", "application/json");
    headers.put("Accept", "application/json");

    this.apiContext =
        request.newContext(
            new APIRequest.NewContextOptions()
                .setBaseURL(baseUrl)
                .setExtraHTTPHeaders(headers)
                .setIgnoreHTTPSErrors(true));
  }

  public String authenticate(String username, String password, String subscriberId) {
    Map<String, Object> payload = new HashMap<>();
    payload.put("username", username);
    payload.put("password", password);
    payload.put("subscriberId", subscriberId);

    APIResponse response = apiContext.post("/api/auth/login", RequestOptions.create().setData(payload));

    if (!response.ok()) {
      throw new RuntimeException(
          "Authentication failed: " + response.status() + " " + response.statusText());
    }

    authToken = extractToken(response.text());
    return authToken;
  }

  public String get(String endpoint) {
    APIResponse response =
        apiContext.get(
            endpoint,
            RequestOptions.create()
                .setHeader("Authorization", "Bearer " + authToken));

    if (!response.ok()) {
      throw new RuntimeException("GET " + endpoint + " failed: " + response.status());
    }
    return response.text();
  }

  public String post(String endpoint, Map<String, Object> data) {
    APIResponse response =
        apiContext.post(
            endpoint,
            RequestOptions.create()
                .setHeader("Authorization", "Bearer " + authToken)
                .setData(data));

    if (!response.ok()) {
      throw new RuntimeException("POST " + endpoint + " failed: " + response.status());
    }
    return response.text();
  }

  public void delete(String endpoint) {
    APIResponse response =
        apiContext.delete(
            endpoint,
            RequestOptions.create()
                .setHeader("Authorization", "Bearer " + authToken));

    if (!response.ok()) {
      throw new RuntimeException("DELETE " + endpoint + " failed: " + response.status());
    }
  }

  public void dispose() {
    if (apiContext != null) {
      apiContext.dispose();
    }
    playwright.close();
  }

  private String extractToken(String responseBody) {
    Pattern tokenPattern = Pattern.compile("\"token\"\\s*:\\s*\"([^\"]+)\"");
    Matcher tokenMatcher = tokenPattern.matcher(responseBody);
    if (tokenMatcher.find()) {
      return tokenMatcher.group(1);
    }

    Pattern accessTokenPattern = Pattern.compile("\"access_token\"\\s*:\\s*\"([^\"]+)\"");
    Matcher accessTokenMatcher = accessTokenPattern.matcher(responseBody);
    if (accessTokenMatcher.find()) {
      return accessTokenMatcher.group(1);
    }

    return "";
  }
}
