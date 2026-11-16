@echo off
rem Fetches every dependency of Material Choco. Needs only Node.js 22 or newer on the PATH.
rem Usage: scripts\fetch-deps.bat
rem build.bat can download a portable Node.js first and then runs the same script.
setlocal
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found on the PATH. Install Node.js 22 or newer, or run build.bat, which downloads a portable copy.
  exit /b 1
)
node "%~dp0fetch-deps.mjs" %*
exit /b %errorlevel%
