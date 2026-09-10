@echo off
cd /d "%~dp0"
echo Seeding database...
call npm.cmd run seed
pause
