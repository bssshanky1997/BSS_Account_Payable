$ErrorActionPreference = "Stop"
# Ensure native command stderr (for example npm notices) does not terminate script execution.
Set-Variable -Name PSNativeCommandUseErrorActionPreference -Value $false -Scope Script -ErrorAction SilentlyContinue

$ScriptDir = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
$ProjectDir = (Resolve-Path $ScriptDir).Path
$LogDir = Join-Path $ProjectDir "logs"
$ReportDir = Join-Path $ProjectDir "reports\report\html-report"
$JsonReportPath = Join-Path $ProjectDir "reports\result\json-report\results.json"
$ExcelReportDir = Join-Path $ProjectDir "reports\report"
$LatestExcelPath = Join-Path $ProjectDir "reports\result\last-run-results.xlsx"
$ExcelArchiveDir = Join-Path $ProjectDir "reports\result\excel-archive"
$ArchiveRootDir = Join-Path $ProjectDir "reports\result\report-archive"
$TimestampReportsRoot = Join-Path $ProjectDir "Reports"
$ScheduledTaskLabel = "Playwright_Daily_10PM"
$DefaultReportRecipients = "YSehra@birchstreet.net;shpandey@birchstreet.net"
$ReportRecipients = if (-not [string]::IsNullOrWhiteSpace($env:REPORT_EMAIL_TO)) { $env:REPORT_EMAIL_TO } else { $DefaultReportRecipients }
$ReportCcRecipients = $env:REPORT_EMAIL_CC
$SendReportEmail = if ([string]::IsNullOrWhiteSpace($env:SEND_REPORT_EMAIL)) {
    $true
}
else {
    $env:SEND_REPORT_EMAIL.Trim().ToLower() -eq "true"
}

New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
New-Item -ItemType Directory -Path $ArchiveRootDir -Force | Out-Null
New-Item -ItemType Directory -Path $ExcelReportDir -Force | Out-Null
New-Item -ItemType Directory -Path $ExcelArchiveDir -Force | Out-Null
New-Item -ItemType Directory -Path (Split-Path $LatestExcelPath -Parent) -Force | Out-Null
New-Item -ItemType Directory -Path $TimestampReportsRoot -Force | Out-Null

$ts = Get-Date -Format "yyyyMMdd_HHmmss"
$logFile = Join-Path $LogDir "playwright_$ts.log"
$runReportDir = Join-Path $TimestampReportsRoot $ts
New-Item -ItemType Directory -Path $runReportDir -Force | Out-Null

function Write-Log {
    param([string]$Message)
    $entry = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') | $Message"
    $entry | Tee-Object -FilePath $logFile -Append
}

function Invoke-NativeCommand {
    param(
        [scriptblock]$Command
    )

    $previousPreference = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        & $Command
        return $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $previousPreference
    }
}

function Send-ExecutionReportEmail {
    param(
        [string]$RunDirectory,
        [int]$RunExitCode
    )

    if (-not $SendReportEmail) {
        Write-Log "Email sending disabled. Set SEND_REPORT_EMAIL=true to enable."
        return
    }

    if ([string]::IsNullOrWhiteSpace($ReportRecipients)) {
        Write-Log "Email recipients are empty. Set REPORT_EMAIL_TO to enable report delivery."
        return
    }

    $emailSummaryPath = Join-Path $RunDirectory "email-summary.html"
    if (-not (Test-Path $emailSummaryPath)) {
        Write-Log "Email summary HTML not found at $emailSummaryPath. Skipping report email."
        return
    }

    $excelAttachment = Get-ChildItem -Path $RunDirectory -Filter "playwright-result_*.xlsx" -ErrorAction SilentlyContinue |
        Select-Object -First 1
    $attachments = @(
        Join-Path $RunDirectory "detailed-execution-report.html"
        Join-Path $RunDirectory "execution-summary.json"
        Join-Path $RunDirectory "failed-tests.json"
    )
    if ($excelAttachment) {
        $attachments += $excelAttachment.FullName
    }

    $runStatus = if ($RunExitCode -eq 0) { "PASSED" } else { "FAILED" }
    $subject = "Playwright Scheduled Execution [$runStatus] - $(Split-Path $RunDirectory -Leaf)"
    $htmlBody = Get-Content -Path $emailSummaryPath -Raw

    try {
        $outlook = New-Object -ComObject Outlook.Application
        $mailItem = $outlook.CreateItem(0)
        $mailItem.To = $ReportRecipients
        if (-not [string]::IsNullOrWhiteSpace($ReportCcRecipients)) {
            $mailItem.CC = $ReportCcRecipients
        }
        $mailItem.Subject = $subject
        $mailItem.HTMLBody = $htmlBody

        foreach ($filePath in $attachments) {
            if ($filePath -and (Test-Path $filePath)) {
                [void]$mailItem.Attachments.Add($filePath)
            }
        }

        $mailItem.Send()
        Write-Log "Execution report email sent to: $ReportRecipients"
    }
    catch {
        Write-Log "Warning: Report email sending failed. $($_.Exception.Message)"
    }
}

try {
    $runStart = Get-Date
    Write-Log "Run started."
    Set-Location $ProjectDir

    $nodeCommand = Get-Command node -ErrorAction SilentlyContinue
    $npxCommand = Get-Command npx -ErrorAction SilentlyContinue

    if (-not $nodeCommand -or -not $npxCommand) {
        throw "Node.js/NPX not found in PATH for scheduled task user. Ensure Node.js is installed and available for non-interactive sessions."
    }

    $nodeDir = Split-Path -Parent $nodeCommand.Source
    if (-not [string]::IsNullOrWhiteSpace($nodeDir) -and -not (($env:PATH -split ';') -contains $nodeDir)) {
        $env:PATH = "$nodeDir;$env:PATH"
    }

    # Use headless mode for scheduled runs that execute without an active desktop session.
    $env:PW_HEADLESS = "true"
    $env:SCHEDULED_RUN = "true"

    if ($env:SKIP_BROWSER_INSTALL -ne "true") {
        Write-Log "Ensuring Playwright browser binaries are installed..."
        $installExitCode = Invoke-NativeCommand { npx playwright install chromium *>> $logFile }
        if ($installExitCode -ne 0) {
            throw "Playwright browser install failed with exit code $installExitCode."
        }
    }

    Write-Log "Starting Playwright tests (sequential, continue on failure)..."
    $exitCode = Invoke-NativeCommand { npx playwright test --workers=1 --max-failures=0 *>> $logFile }
    $runEnd = Get-Date

    $excelOutput = Join-Path $runReportDir "playwright-result_$ts.xlsx"
    Write-Log "Generating Excel report..."
    $excelReportExitCode = Invoke-NativeCommand {
        node ".\scripts\generate-excel-report.js" `
            --jsonPath "$JsonReportPath" `
            --outputPath "$excelOutput" `
            --latestOutputPath "$LatestExcelPath" `
            --runStart "$($runStart.ToString('o'))" `
            --runEnd "$($runEnd.ToString('o'))" `
            --taskName "$ScheduledTaskLabel" `
            --testExitCode "$exitCode" *>> $logFile
    }

    if ($excelReportExitCode -eq 0) {
        Write-Log "Excel report generated: $excelOutput"
        $compatExcelOutput = Join-Path $ExcelArchiveDir "daily-report-schedule_$ts.xlsx"
        Copy-Item -Path $excelOutput -Destination $compatExcelOutput -Force
        Write-Log "Excel report archived (legacy location): $compatExcelOutput"
    }
    else {
        Write-Log "Warning: Excel report generation failed."
    }

    Write-Log "Generating detailed scheduled summary artifacts..."
    $scheduledSummaryExitCode = Invoke-NativeCommand {
        node ".\scripts\generate-scheduled-summary.js" `
            --projectRoot "$ProjectDir" `
            --jsonPath "$JsonReportPath" `
            --outputDir "$runReportDir" `
            --runStart "$($runStart.ToString('o'))" `
            --runEnd "$($runEnd.ToString('o'))" `
            --taskName "$ScheduledTaskLabel" `
            --testExitCode "$exitCode" *>> $logFile
    }

    if ($scheduledSummaryExitCode -eq 0) {
        Write-Log "Detailed summary artifacts generated in: $runReportDir"
    }
    else {
        Write-Log "Warning: Detailed summary generation failed."
    }

    if (Test-Path $ReportDir) {
        $archiveDir = Join-Path $ArchiveRootDir "html-report_$ts"
        Copy-Item -Path $ReportDir -Destination $archiveDir -Recurse -Force
        Write-Log "HTML report archived: $archiveDir"

        $timestampHtmlDir = Join-Path $runReportDir "html-report"
        Copy-Item -Path $ReportDir -Destination $timestampHtmlDir -Recurse -Force
        Write-Log "HTML report copied to timestamp folder: $timestampHtmlDir"
    }
    else {
        Write-Log "Warning: HTML report folder not found at $ReportDir"
    }

    if (Test-Path $JsonReportPath) {
        $jsonCopyPath = Join-Path $runReportDir "results.json"
        Copy-Item -Path $JsonReportPath -Destination $jsonCopyPath -Force
        Write-Log "JSON result copied: $jsonCopyPath"
    }

    if (Test-Path $logFile) {
        $logCopyPath = Join-Path $runReportDir "execution.log"
        Copy-Item -Path $logFile -Destination $logCopyPath -Force
        Write-Log "Execution log copied: $logCopyPath"
    }

    Send-ExecutionReportEmail -RunDirectory $runReportDir -RunExitCode $exitCode

    Write-Log "Run finished with exit code: $exitCode"
    Write-Log "Run artifacts directory: $runReportDir"
    exit $exitCode
}
catch {
    Write-Log "Unhandled error: $($_.Exception.Message)"
    exit 1
}
