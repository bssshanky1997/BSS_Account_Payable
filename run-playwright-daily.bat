@echo off
setlocal

set "SCRIPT_PATH=C:\Users\shpandey.CORP\Playwrights_Framework\Bss_AccountPayable\run-playwright-daily.ps1"

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_PATH%"
set "EXIT_CODE=%ERRORLEVEL%"

endlocal & exit /b %EXIT_CODE%
