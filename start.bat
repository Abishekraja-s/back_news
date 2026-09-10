@echo off
cd /d "%~dp0"
echo ========================================
echo  BACKEND - The Great India News API
echo ========================================
echo.
if not exist node_modules (
  echo Installing dependencies...
  call npm.cmd install
)
if not exist .env (
  echo Copying .env.example to .env ...
  copy .env.example .env
)
echo Starting API on http://localhost:5000
echo.
call npm.cmd run dev
pause
