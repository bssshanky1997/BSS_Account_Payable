param(
    [string]$TaskName = "Playwright_Daily_10PM",
    [string]$TaskUser = "$env:USERDOMAIN\$env:USERNAME",
    [string]$ScriptPath = "",
    [switch]$PromptForCredentials = $true
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($ScriptPath)) {
    $ScriptPath = Join-Path $PSScriptRoot "run-playwright-daily.ps1"
}

if (!(Test-Path $ScriptPath)) {
    throw "Runner script not found: $ScriptPath"
}

if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
}

$resolvedScriptPath = (Resolve-Path $ScriptPath).Path
$scriptDirectory = Split-Path -Parent $resolvedScriptPath
$powershellExe = Join-Path $PSHOME "powershell.exe"

$action = New-ScheduledTaskAction `
    -Execute $powershellExe `
    -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$resolvedScriptPath`"" `
    -WorkingDirectory $scriptDirectory

$trigger = New-ScheduledTaskTrigger -Daily -At 10:00PM

$settings = New-ScheduledTaskSettingsSet `
    -StartWhenAvailable `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -MultipleInstances IgnoreNew `
    -ExecutionTimeLimit (New-TimeSpan -Hours 4)

if (-not $PromptForCredentials) {
    throw "Credential prompt disabled. Provide a credential-capable registration flow for -LogonType Password."
}

$credential = Get-Credential -UserName $TaskUser -Message "Enter credentials for scheduled task: $TaskName"
if (-not $credential) {
    throw "Task registration cancelled. No credentials provided."
}

$credentialPtr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($credential.Password)
try {
    $plainPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($credentialPtr)
}
finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($credentialPtr)
}

Register-ScheduledTask `
    -TaskName $TaskName `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -User $credential.UserName `
    -Password $plainPassword `
    -RunLevel Highest `
    -Force

Write-Host "Task created successfully: $TaskName"
Write-Host "Task user: $($credential.UserName)"
Write-Host "Runner script: $resolvedScriptPath"
Write-Host "Use this to test immediately:"
Write-Host "Start-ScheduledTask -TaskName `"$TaskName`""
