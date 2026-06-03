# Playwright Daily Scheduler (Windows)

This document explains how to run the Playwright suite automatically every day at 10:00 PM for this project.

Project root:

`C:\Users\shpandey.CORP\Playwrights_Framework\Bss_AccountPayable`

## Files Included

- `run-playwright-daily.ps1` - Executes Playwright tests, writes logs, archives HTML report, generates Excel result report.
- `run-playwright-daily.bat` - Batch wrapper to launch the PowerShell runner.
- `setup-playwright-task.ps1` - Creates/recreates the Windows scheduled task.
- `scripts/generate-excel-report.js` - Converts Playwright JSON results into Excel (`.xlsx`) with run timeframe and test details.

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
- Task User: `CORP\shpandey`
- Schedule: Daily at `10:00 PM`
- Run Level: Highest
- Logon Type: Password (allows run while user is logged out)

You will be prompted for password when task is registered.

## Optional Custom Setup

You can override task name/user/script path:

```powershell
.\setup-playwright-task.ps1 `
  -TaskName "Playwright_AP_Daily_10PM" `
  -TaskUser "CORP\shpandey" `
  -ScriptPath "C:\Users\shpandey.CORP\Playwrights_Framework\Bss_AccountPayable\run-playwright-daily.ps1"
```

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
  - `C:\Users\shpandey.CORP\Playwrights_Framework\Bss_AccountPayable\logs\playwright_yyyyMMdd_HHmmss.log`
- Latest Playwright HTML report:
  - `C:\Users\shpandey.CORP\Playwrights_Framework\Bss_AccountPayable\reports\html-report\index.html`
- Archived report per run:
  - `C:\Users\shpandey.CORP\Playwrights_Framework\Bss_AccountPayable\reports-archive\html-report_yyyyMMdd_HHmmss\index.html`
- Excel report per run (includes run start/end timeframe, duration, pass/fail summary, and test-level details):
  - `C:\Users\shpandey.CORP\Playwrights_Framework\Bss_AccountPayable\excel-archive\playwright-result_yyyyMMdd_HHmmss.xlsx`
  - Sheets:
    - `RunSummary` - Run-level timeframe and totals
    - `TestDetails` - Test-level result rows
    - `FailureByModule` - Grouped failed tests by spec/module with failure counts and sample error
    - `FailureTrend` - Recent run trend (up to 30 runs) with pass/fail counts, pass rate, failure rate, and duration
- Manual Excel generation (optional):
  - `npm run report:excel`

## Scheduler-Friendly Runtime Behavior

The runner script sets:

- `PW_HEADLESS=true`
- `SCHEDULED_RUN=true`

In `playwright.config.ts`, this ensures:

- headless mode is used for scheduled runs
- HTML report does not auto-open during scheduler execution

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
- Node/NPM not found:
  - Run task user account once interactively and verify:
    - `node -v`
    - `npm -v`
    - `npx -v`

## Remove Task

```powershell
Unregister-ScheduledTask -TaskName "Playwright_Daily_10PM" -Confirm:$false
```
