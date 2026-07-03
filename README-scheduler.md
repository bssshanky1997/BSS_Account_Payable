# Playwright Daily Scheduler (Windows)

This document explains how to run the Playwright suite automatically every day at 10:00 PM for this project.

Project root (example):

`<your-clone-path>\Bss_AccountPayable`

## Files Included

- `run-playwright-daily.ps1` - Executes Playwright tests, writes logs, archives HTML report, generates Excel result report.
- `run-playwright-daily.bat` - Batch wrapper to launch the PowerShell runner.
- `setup-playwright-task.ps1` - Creates/recreates the Windows scheduled task.
- `scripts/generate-excel-report.js` - Converts Playwright JSON results into Excel (`.xlsx`) with run timeframe and test details.
- `scripts/generate-scheduled-summary.js` - Creates readable HTML summary, failed-tests list, execution JSON summary, and email-friendly HTML summary.

## One-Time Setup

Open PowerShell in project root and run:

```powershell
.\setup-playwright-task.ps1
```

Or run via npm:

```powershell
npm run setup:scheduler
```

Default settings used by the setup script:

- Task Name: `Playwright_Daily_10PM`
- Task User: current Windows user (`$env:USERDOMAIN\$env:USERNAME`)
- Schedule: Daily at `10:00 PM`
- Run Level: Highest
- Logon Type: Password (allows run while user is logged out)

You will be prompted for credentials when task is registered.

## Optional Custom Setup

You can override task name/user/script path:

```powershell
.\setup-playwright-task.ps1 `
  -TaskName "Playwright_AP_Daily_10PM" `
  -TaskUser "CORP\youruser" `
  -ScriptPath "D:\Automation\Bss_AccountPayable\run-playwright-daily.ps1"
```

Notes:

- If `-ScriptPath` is not provided, the setup script auto-resolves `run-playwright-daily.ps1` from the same folder.
- By default, setup prompts for credentials (`-PromptForCredentials` enabled).

## Manual Test Run

Run the task immediately:

```powershell
Start-ScheduledTask -TaskName "Playwright_Daily_10PM"
```

Check last/next execution:

```powershell
Get-ScheduledTaskInfo -TaskName "Playwright_Daily_10PM" | Format-List LastRunTime,LastTaskResult,NextRunTime
```

Success indicator:

- `LastTaskResult` = `0`

## Logs and Reports

- Run logs:
  - `<project-root>\logs\playwright_yyyyMMdd_HHmmss.log`
- Latest Playwright HTML report:
  - `<project-root>\reports\report\html-report\index.html`
- Archived report per run:
  - `<project-root>\reports\result\report-archive\html-report_yyyyMMdd_HHmmss\index.html`
- Excel report per run (includes run start/end timeframe, duration, pass/fail summary, and test-level details):
  - `<project-root>\Reports\yyyyMMdd_HHmmss\playwright-result_yyyyMMdd_HHmmss.xlsx`
  - Legacy archive copy:
    - `<project-root>\reports\result\excel-archive\daily-report-schedule_yyyyMMdd_HHmmss.xlsx`
  - Sheets:
    - `RunSummary` - Run-level timeframe and totals
    - `TestDetails` - Test-level result rows
    - `FailureByModule` - Grouped failed tests by spec/module with failure counts and sample error
    - `FailureTrend` - Recent run trend (up to 30 runs) with pass/fail counts, pass rate, failure rate, and duration
- Timestamped nightly run artifacts folder:
  - `<project-root>\Reports\yyyyMMdd_HHmmss\`
  - Includes:
    - `detailed-execution-report.html` (test table with name, status, start/end time, duration)
    - `failed-tests.json` (failure reason, stack trace, screenshot/trace/video paths)
    - `execution-summary.json` (total, pass/fail/skipped, pass percentage)
    - `email-summary.html` (email-friendly summary)
    - `results.json` (Playwright raw JSON copy)
    - `html-report\index.html` (Playwright HTML report copy)
- Manual Excel generation (optional):
  - `npm run report:excel`

## Scheduler-Friendly Runtime Behavior

The runner script sets:

- `PW_HEADLESS=true`
- `SCHEDULED_RUN=true`

Optional email delivery environment variables:

- `SEND_REPORT_EMAIL=true|false` (default: `true`)
- `REPORT_EMAIL_TO` (semicolon-separated recipients; defaults to configured recipients in `run-playwright-daily.ps1`)
- `REPORT_EMAIL_CC` (optional semicolon-separated CC recipients)

The runner script also:

- auto-installs Chromium browser binaries before the run (`npx playwright install chromium`)
- supports opting out by setting `SKIP_BROWSER_INSTALL=true`
- sends `email-summary.html` as the email body and attaches detailed report artifacts via Outlook Desktop COM automation

In `playwright.config.ts`, this ensures:

- headless mode is used for scheduled runs
- HTML report does not auto-open during scheduler execution
- scheduled runs execute sequentially (`--workers=1`) and do not stop on first failure (`--max-failures=0`)

## Troubleshooting

- Task not running:
  - Verify task exists: `Get-ScheduledTask -TaskName "Playwright_Daily_10PM"`
  - Ensure Task Scheduler history is enabled and check event details.
- LastTaskResult is not 0:
  - Open latest log file in `logs` folder and inspect failure command/output.
- Browser launch issues in background:
  - Confirm tests support headless execution.
  - Ensure Playwright browsers are installed:
    - `npx playwright install`
  - If nightly runner should skip install for a locked-down environment, set `SKIP_BROWSER_INSTALL=true` and preinstall browsers in advance.
- Node/NPM not found:
  - Run task user account once interactively and verify:
    - `node -v`
    - `npm -v`
    - `npx -v`

## Remove Task

```powershell
Unregister-ScheduledTask -TaskName "Playwright_Daily_10PM" -Confirm:$false
```
