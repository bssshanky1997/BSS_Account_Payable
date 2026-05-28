# BSS Account Payable - Playwright TypeScript Automation Framework

End-to-end test automation for the BirchStreet Account Payable module using Playwright Test + TypeScript.

## Project Structure

```text
Bss_AccountPayable/
├── tests/Regression_Suite/            # Playwright TypeScript specs
├── tests/Fuctional_Suite/             # Functional suite TypeScript specs
├── pages/                             # TypeScript page objects
├── fixtures/                          # Custom Playwright fixtures
├── utils/                             # Shared TypeScript utilities
├── config/                            # Environment configuration
├── playwright.config.ts               # Playwright runtime configuration
├── tsconfig.json                      # TypeScript compiler configuration
├── package.json                       # Node dependencies and scripts
├── screenshots/                       # Screenshot artifacts by test file
├── reports/                           # HTML + Allure report artifacts
├── test-results/                      # Runtime test output and last-run summary
└── reports/excel-results/             # Exported Excel summary files
```

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Installation

```bash
cd Bss_AccountPayable
npm install
npx playwright install chromium
```

### Environment Variables

Set credentials before running tests, or create a `.env` file in `Bss_AccountPayable/`.

```bash
$env:USERNAME = "your_username"
$env:PASSWORD = "your_password"
$env:SUBSCRIBER_ID = "your_subscriber_id"
$env:BASE_URL = "https://appqa.birchstreet.co"
$env:API_BASE_URL = "https://qa-api.birchstreet.net"
```

## Running Tests

Run all tests:

```bash
npm test
```

Run headed:

```bash
npm run test:headed
```

## Reports

Show HTML report:

```bash
npm run report
```

Generate Allure results:

```bash
npm test
npm run allure:generate
npm run allure:open
```

## Notes

- Screenshots are automatically captured for non-skipped tests into `screenshots/<test_file>/`.
- Authentication state for long-running suites is cached under `test-results/.auth/`.
- Legacy Python and Java assets may still exist in the repository for reference.
