@echo off
rem Builds the release-equivalent Squirrel.Windows installer into dist\squirrel-windows.
rem Usage: build-installer.bat [/s | --silent]   (or set SILENT=1)
setlocal
cd /d "%~dp0"
set "BUILD_ONLY=1"
call "%~dp0build.bat" %* || exit /b %errorlevel%
echo [installer] electron-builder
call npx electron-builder --win squirrel --x64 --publish never || exit /b %errorlevel%
echo.
echo Installer files:
dir /b dist\squirrel-windows
echo.
echo These files are not code signed. Windows may show an unknown publisher warning.
exit /b 0
