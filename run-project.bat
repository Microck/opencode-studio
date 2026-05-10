@echo off
setlocal enableextensions

set "PROJECT_DIR=%~dp0"
if "%PROJECT_DIR:~-1%"=="\" set "PROJECT_DIR=%PROJECT_DIR:~0,-1%"

echo [1/3] Checking for running project processes...

taskkill /FI "WINDOWTITLE eq OpenCode Studio - Dev*" /F /T >nul 2>&1

set "PS_SCRIPT=$dir = [Regex]::Escape($env:PROJECT_DIR);"
set "PS_SCRIPT=%PS_SCRIPT% $targets = @(Get-CimInstance Win32_Process | Where-Object { $_.Name -ieq 'node.exe' -and $_.CommandLine -match $dir });"
set "PS_SCRIPT=%PS_SCRIPT% if($targets.Count -gt 0){ foreach($p in $targets){ Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue }; $targets.Count } else { 0 }"

for /f %%i in ('powershell -NoProfile -ExecutionPolicy Bypass -Command "%PS_SCRIPT%"') do set "KILLED=%%i"
if not defined KILLED set "KILLED=0"

if "%KILLED%"=="0" (
  echo No previous instance found.
) else (
  echo Closed %KILLED% running process^(es^).
)

echo [2/3] Starting project...
start "OpenCode Studio - Dev" cmd /k "cd /d ""%PROJECT_DIR%"" && if not exist node_modules\concurrently\package.json (echo Installing dependencies... && npm install) && npm start"

echo [3/3] Done.
endlocal
