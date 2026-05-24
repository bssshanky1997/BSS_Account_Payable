# BSS Account Payable - Java (Playwright + JUnit 5)

This folder contains the Java conversion of the TypeScript framework under `Bss_AccountPayable`.

## Converted Modules

- `config/qa.env.ts` -> `config/EnvConfig.java`
- `utils/constants.ts` -> `utils/Constants.java`
- `utils/testData.ts` -> `utils/TestData.java`
- `utils/apiHelper.ts` -> `utils/ApiHelper.java`
- `fixtures/testFixture.ts` -> `fixtures/BaseUiTest.java`, `fixtures/BaseApiTest.java`
- `pages/Regression_Suite/Login_Page.ts` -> `pages/regression/LoginPage.java`
- `pages/Regression_Suite/Create_NON_Invoice_Page.ts` -> `pages/regression/ApInvoicePage.java`
- `tests/Regression_Suite/Login_LandingPage.spec.ts` -> `tests/regression/LoginLandingPageTest.java`
- `tests/Regression_Suite/Create_NONPO_Invoice.ts` -> `tests/regression/CreateNonPoInvoiceTest.java`

## Prerequisites

- Java 17+
- Maven 3.9+

## Run

```bash
cd Bss_AccountPayable/java
mvn -Dtest=LoginLandingPageTest test
mvn -Dtest=CreateNonPoInvoiceTest test
```

## Environment Variables

Set these before running tests:

- `BASE_URL` (default `https://appqa.birchstreet.co`)
- `USERNAME`
- `PASSWORD`
- `SUBSCRIBER_ID`
- `API_BASE_URL` (default `https://qa-api.birchstreet.net`)
- `CI` (`true` on CI to run headless)
