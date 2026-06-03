param(
    [string]$TaskName = "Playwright_Daily_10PM",
    [string]$TaskUser = "CORP\shpandey",
    [string]$ScriptPath = "C:\Users\shpandey.CORP\Playwrights_Framework\Bss_AccountPayable\run-playwright-daily.ps1"
)

$ErrorActionPreference = "Stop"

if (!(Test-Path $ScriptPath)) {
    throw "Runner script not found: $ScriptPath"
}

if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
}

$action = New-ScheduledTaskAction `
    -Execute "powershell.exe" `
    -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$ScriptPath`""

$trigger = New-ScheduledTaskTrigger -Daily -At 10:00PM

$principal = New-ScheduledTaskPrincipal `
    -UserId $TaskUser `
    -LogonType Password `
    -RunLevel Highest

$settings = New-ScheduledTaskSettingsSet `
    -StartWhenAvailable `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -MultipleInstances IgnoreNew `
    -ExecutionTimeLimit (New-TimeSpan -Hours 4)

Register-ScheduledTask `
    -TaskName $TaskName `
    -Action $action `
    -Trigger $trigger `
    -Principal $principal `
    -Settings $settings

Write-Host "Task created successfully: $TaskName"
Write-Host "Use this to test immediately:"
Write-Host "Start-ScheduledTask -TaskName `"$TaskName`""
