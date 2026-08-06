@echo off
REM ---------------------------------------------------------------------------
REM  Waste Opportunities - one-click start for Windows
REM  Double-click this file, or run  start.bat  from a terminal.
REM ---------------------------------------------------------------------------

cd /d "%~dp0"

echo.
echo   Starting Waste Opportunities...
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

REM No install is needed for the default AI provider (Google Gemini) - it uses
REM plain fetch. The optional Anthropic SDK is only for the Claude provider,
REM so we never block startup on npm.
if not exist "node_modules" (
  echo   Installing optional dependencies ^(safe to skip if this fails^)...
  call npm install --no-audit --no-fund
  echo.
)

REM Remind the user to add an API key if they have not
if not exist ".env" (
  echo   NOTE: No .env file found, so the chatbot will use the offline assistant.
  echo         For the full AI: copy .env.example to .env and add a free
  echo         Gemini key from https://aistudio.google.com/apikey
  echo.
)

REM Open the browser shortly after the server boots
start "" cmd /c "timeout /t 2 >nul && start http://localhost:3000"

node server/server.js

pause
