@echo off
REM Double-click this file to set everything up (first time only).
setlocal
cd /d "%~dp0.."

echo ==================================================
echo  Desktop QA Recorder -- first-time setup
echo ==================================================
echo.

where python >nul 2>nul
if errorlevel 1 (
  echo Python isn't installed. Install it from https://www.python.org/downloads/
  echo ^(check "Add python.exe to PATH" during install^), then run this again.
  pause
  exit /b 1
)

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js isn't installed. Install it from https://nodejs.org ^(LTS version^),
  echo then run this again.
  pause
  exit /b 1
)

echo Found Python and Node.js.
echo.

echo -- Setting up the recording/replay engine...
python -m venv .venv
call .venv\Scripts\activate.bat
pip install --quiet --upgrade pip
pip install --quiet -r requirements.txt

echo -- Setting up the dashboard (this can take a minute)...
cd dashboard
call npm install --silent
cd ..

echo.
echo ==================================================
echo  Setup complete!
echo.
echo  Next: double-click start.bat to launch the app.
echo ==================================================
echo.
pause
