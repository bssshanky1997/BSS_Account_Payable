$ErrorActionPreference = "Stop"

$ProjectDir = "C:\Users\shpandey.CORP\Playwrights_Framework\Bss_AccountPayable"
$LogDir = Join-Path $ProjectDir "logs"
$ReportDir = Join-Path $ProjectDir "reports\html-report"
$JsonReportPath = Join-Path $ProjectDir "reports\json-report\results.json"
$ExcelReportDir = Join-Path $ProjectDir "reports\excel-report"
$ExcelArchiveDir = Join-Path $ProjectDir "excel-archive"
$ArchiveRootDir = Join-Path $ProjectDir "reports-archive"

New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
New-Item -ItemType Directory -Path $ArchiveRootDir -Force | Out-Null
New-Item -ItemType Directory -Path $ExcelReportDir -Force | Out-Null
New-Item -ItemType Directory -Path $ExcelArchiveDir -Force | Out-Null

$ts = Get-Date -Format "yyyyMMdd_HHmmss"
$logFile = Join-Path $LogDir "playwright_$ts.log"

function Write-Log {
    param([string]$Message)
    $entry = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') | $Message"
    $entry | Tee-Object -FilePath $logFile -Append
}

try {
    $runStart = Get-Date
    Write-Log "Run started."
    Set-Location $ProjectDir

    # Use headless mode for scheduled runs that execute without an active desktop session.
    $env:PW_HEADLESS = "true"
    $env:SCHEDULED_RUN = "true"

    Write-Log "Starting Playwright tests..."
    npx playwright test *>> $logFile
    $exitCode = $LASTEXITCODE
    $runEnd = Get-Date

    $excelOutput = Join-Path $ExcelArchiveDir "playwright-result_$ts.xlsx"
    Write-Log "Generating Excel report..."
    node ".\scripts\generate-excel-report.js" `
        --jsonPath "$JsonReportPath" `
        --outputPath "$excelOutput" `
        --runStart "$($runStart.ToString('o'))" `
        --runEnd "$($runEnd.ToString('o'))" `
        --taskName "Playwright_Daily_10PM" `
        --testExitCode "$exitCode" *>> $logFile

    if ($LASTEXITCODE -eq 0) {
        Write-Log "Excel report generated: $excelOutput"
    }
    else {
        Write-Log "Warning: Excel report generation failed."
    }

    if (Test-Path $ReportDir) {
        $archiveDir = Join-Path $ArchiveRootDir "html-report_$ts"
        Copy-Item -Path $ReportDir -Destination $archiveDir -Recurse -Force
        Write-Log "HTML report archived: $archiveDir"
    }
    else {
        Write-Log "Warning: HTML report folder not found at $ReportDir"
    }

    Write-Log "Run finished with exit code: $exitCode"
    exit $exitCode
}
catch {
    Write-Log "Unhandled error: $($_.Exception.Message)"
    exit 1
}
