@echo off
cd /d "%~dp0"
if not exist node_modules call npm.cmd install
if not exist .env copy .env.example .env
call npm.cmd run dev
