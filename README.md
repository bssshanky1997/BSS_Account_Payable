# BSS Account Payable - Playwright TypeScript Automation Framework

End-to-end test automation for the BirchStreet Account Payable module using Playwright Test + TypeScript.

## Project Structure

```text
Bss_AccountPayable/
├── tests/Fuctional_Suite/             # Functional suite specs
├── POM-Classes/Fuctional_Suite/       # Page Object Model classes
├── fixtures/                          # Custom Playwright fixtures
├── hooks/                             # Global setup and lifecycle hooks
├── scripts/                           # Report and utility scripts
├── config/                            # Environment configuration
├── utils/                             # Shared TypeScript utilities
├── playwright.config.ts               # Playwright runtime configuration
├── tsconfig.json                      # TypeScript compiler configuration
├── package.json                       # Node dependencies and scripts
├── reports/                           # Generated reports and runtime artifacts
├── Reports/                           # Timestamped nightly run bundles
├── logs/                              # Scheduler run logs
├── run-playwright-daily.ps1           # Nightly execution runner
└── setup-playwright-task.ps1          # Windows Task Scheduler registration
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
$env:TARGET_COMPANY_ID = "931"
$env:RECEIVING_PO_NUMBER = "P123456"
$env:RECEIVING_QTY = "1"
$env:BASE_URL = "https://appqa.birchstreet.co"
$env:API_BASE_URL = "https://qa-api.birchstreet.net"
```

`Receiving_PO_Test.spec.ts` uses:
- `RECEIVING_PO_NUMBER` (required for that test)
- `RECEIVING_QTY` (optional, default `1`)

For Right ID API automation (Admin Position screen 10523 via `DocumentLoad.jsp`/`DocumentSave.jsp`), optional vars:

```bash
$env:RIGHTS_POSITION_ID = "2"
$env:RIGHTS_TARGET_ID = "4051"
$env:RIGHTS_APPLICATION_NAME = "PROCUREMENT"
```

## Running Tests

Run all tests:

```bash
npm test
```

Nightly runner note:
- `run-playwright-daily.ps1` executes `npx playwright test`, so specs under `Test_Classes/**/*.spec.ts` (including `Receiving_PO_Test.spec.ts`) are included automatically.

Run headed:

```bash
npm run test:headed
```

Run debug mode:

```bash
npm run test:debug
```

Open Playwright UI mode:

```bash
npm run test:ui
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

Generate Excel summary from JSON report:

```bash
npm run report:excel
```

Generate scheduler-style summary artifacts (HTML/JSON/email):

```bash
npm run report:scheduled
```

## Nightly Scheduler

- Setup 10 PM scheduled execution on Windows:

```bash
npm run setup:scheduler
```

- Runner script: `run-playwright-daily.ps1`
- Scheduler guide: `README-scheduler.md`

## Notes

- Failure diagnostics are enabled by default:
  - screenshot on failure
  - trace on failure
  - video on failure
- Authentication state is reused from `playwright/.auth/user.json`.
- Main report outputs:
  - `reports/report/html-report`
  - `reports/result/json-report/results.json`
  - `reports/result/allure-results`
  - `Reports/<timestamp>/` (nightly bundle with execution summary + email summary + failed-tests list)
- Legacy Python and Java assets may still exist in the repository for reference.
