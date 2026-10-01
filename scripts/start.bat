@echo off
REM Double-click this file to launch the dashboard.
REM Run setup.bat first if you haven't already.
setlocal
cd /d "%~dp0.."

if not exist ".venv" (
  echo It looks like setup hasn't run yet.
  echo Double-click setup.bat first, then try this again.
  pause
  exit /b 1
)
if not exist "dashboard\node_modules" (
  echo It looks like setup hasn't run yet.
  echo Double-click setup.bat first, then try this again.
  pause
  exit /b 1
)

echo ==================================================
echo  Starting Desktop QA Recorder...
echo ==================================================
echo.
echo Keep this window open while you use the app.
echo Close it when you're done.
echo.
echo Note: Pause/Resume on a run isn't available on Windows
echo (Stop still works) -- see the README for details.
echo.

cd dashboard
start "" cmd /c "npm run dev"
timeout /t 4 /nobreak >nul
start "" http://localhost:3000

echo Dashboard launching -- if your browser didn't open automatically,
echo go to http://localhost:3000 yourself.
pause
