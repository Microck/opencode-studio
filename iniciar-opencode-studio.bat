@echo off
setlocal

echo ======================================
echo  OpenCode Studio - Inicializacao Local
echo ======================================

set "REPO_DIR=C:\GitHub\opencode-studio"

if not exist "%REPO_DIR%" (
  echo Repositorio nao encontrado em %REPO_DIR%
  pause
  exit /b 1
)

cd /d "%REPO_DIR%"

echo [2/2] Iniciando OpenCode Studio...
start "OpenCode Studio" cmd /k "cd /d ""%REPO_DIR%"" && quickstart.bat"

echo Aguardando frontend subir (localhost:1080)...
for /l %%i in (1,1,60) do (
  powershell -NoProfile -Command "try { $r=Invoke-WebRequest -UseBasicParsing http://localhost:1080 -TimeoutSec 1; exit 0 } catch { exit 1 }" >nul 2>nul
  if not errorlevel 1 goto :openbrowser
  timeout /t 1 /nobreak >nul
)

echo Nao foi possivel confirmar localhost:1080 em 60s.
echo Verifique a janela "OpenCode Studio" para ver a porta correta.
goto :eof

:openbrowser
echo Abrindo no navegador...
start "" "http://localhost:1080"

endlocal
