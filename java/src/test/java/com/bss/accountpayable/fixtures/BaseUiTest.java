package com.bss.accountpayable.fixtures;

import com.microsoft.playwright.Browser;
import com.microsoft.playwright.BrowserContext;
import com.microsoft.playwright.BrowserType;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.Playwright;
import com.microsoft.playwright.options.ScreenshotType;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.TestInfo;

public abstract class BaseUiTest {
  protected Playwright playwright;
  protected Browser browser;
  protected BrowserContext context;
  protected Page page;

  private static final Path SCREENSHOT_DIR = Paths.get("screenshots");

  @BeforeEach
  void baseSetUp() {
    try {
      Files.createDirectories(SCREENSHOT_DIR);
    } catch (Exception ignored) {
      // Do not fail test initialization for screenshot folder issues.
    }

    // Match TS behavior: headed locally, headless on CI.
    boolean headless = "true".equalsIgnoreCase(String.valueOf(System.getenv("CI")));
    playwright = Playwright.create();
    browser = playwright.chromium().launch(new BrowserType.LaunchOptions().setHeadless(headless));
    context = browser.newContext(
        new Browser.NewContextOptions()
            .setViewportSize(1920, 1080)
            .setIgnoreHTTPSErrors(true));
    page = context.newPage();
  }

  @AfterEach
  void baseTearDown(TestInfo testInfo) {
    captureScreenshot(testInfo);
    if (page != null) {
      page.close();
    }
    if (context != null) {
      context.close();
    }
    if (browser != null) {
      browser.close();
    }
    if (playwright != null) {
      playwright.close();
    }
  }

  private void captureScreenshot(TestInfo testInfo) {
    if (page == null) {
      return;
    }

    String testName = testInfo.getDisplayName().replaceAll("[^a-zA-Z0-9-_ ]+", "_").replaceAll("\\s+", "_");
    Path testDir = SCREENSHOT_DIR.resolve(testName);
    try {
      Files.createDirectories(testDir);
      page.screenshot(
          new Page.ScreenshotOptions()
              .setPath(testDir.resolve(testName + ".png"))
              .setFullPage(true)
              .setType(ScreenshotType.PNG));
    } catch (Exception ignored) {
      // Do not fail tests because screenshot capture fails.
    }
  }
}
