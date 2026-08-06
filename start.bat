@echo off
REM ---------------------------------------------------------------------------
REM  LoopNZ - one-click start for Windows
REM  Double-click this file, or run  start.bat  from a terminal.
REM ---------------------------------------------------------------------------

cd /d "%~dp0"

echo.
echo   Starting LoopNZ...
echo.

REM Check Node is installed
where node >nul 2>nul
if errorlevel 1 (
  echo   ERROR: Node.js is not installed or not on your PATH.
  echo   Download it from https://nodejs.org  ^(version 18 or newer^)
  echo.
  pause
  exit /b 1
)

REM Install the Anthropic SDK the first time only.
REM If this fails you can still run the app - it falls back to the offline assistant.
if not exist "node_modules" (
  echo   First run - installing dependencies...
  call npm install
  echo.
)

REM Remind the user to add an API key if they have not
if not exist ".env" (
  echo   NOTE: No .env file found, so the chatbot will use the offline assistant.
  echo         To enable Claude: copy .env.example to .env and add your API key.
  echo.
)

REM Open the browser shortly after the server boots
start "" cmd /c "timeout /t 2 >nul && start http://localhost:3000"

node server/server.js

pause
