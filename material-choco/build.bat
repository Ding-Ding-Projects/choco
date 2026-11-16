@echo off
rem Builds Material Choco from a fresh checkout and starts it.
rem Usage: build.bat [/s | --silent]   (or set SILENT=1)
rem It installs what it needs in user scope: a portable Node.js under %LOCALAPPDATA%\MaterialChocoBuild.
setlocal enabledelayedexpansion
cd /d "%~dp0"
set "QUIET=0"
if /i "%~1"=="/s" set "QUIET=1"
if /i "%~1"=="--silent" set "QUIET=1"
if "%SILENT%"=="1" set "QUIET=1"

echo [1/5] Node.js
where node >nul 2>nul
if errorlevel 1 (
  set "NODE_DIR=%LOCALAPPDATA%\MaterialChocoBuild\node-v22.12.0-win-x64"
  if not exist "!NODE_DIR!\node.exe" (
    echo   Downloading portable Node.js 22 to %LOCALAPPDATA%\MaterialChocoBuild
    powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; $d=Join-Path $env:LOCALAPPDATA 'MaterialChocoBuild'; New-Item -ItemType Directory -Force $d | Out-Null; $z=Join-Path $d 'node.zip'; Invoke-WebRequest 'https://nodejs.org/dist/v22.12.0/node-v22.12.0-win-x64.zip' -OutFile $z; Expand-Archive $z -DestinationPath $d -Force; Remove-Item $z" || goto :fail
  )
  set "PATH=!NODE_DIR!;!PATH!"
)
node --version || goto :fail

echo [2/5] Chocolatey CLI from this repository
if not exist "choco-bundle\choco.exe" (
  pushd ..
  call build.bat --target=CI --testExecutionType=unit --shouldRunOpenCover=false --shouldBuildMsi=false || (popd & goto :fail)
  popd
  powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; $e=Get-ChildItem ..\code_drop -Recurse -Filter choco.exe | Sort-Object { if ($_.FullName -match 'choco_merged') {0} elseif ($_.FullName -match '_PublishedApps') {1} else {2} } | Select-Object -First 1; if (-not $e) { throw 'choco.exe was not produced' }; New-Item -ItemType Directory -Force choco-bundle | Out-Null; Copy-Item (Join-Path $e.DirectoryName '*') choco-bundle -Recurse -Force" || goto :fail
) else ( echo   Using the existing choco-bundle folder )

echo [3/5] npm packages
call npm ci || goto :fail
echo [4/5] Schema and UI bundle
call node scripts\gen-schema.mjs || goto :fail
call node scripts\build-vendor.mjs || goto :fail
if "%BUILD_ONLY%"=="1" goto :ok
echo [5/5] Starting Material Choco
call npx electron . || goto :fail
:ok
echo Build finished.
exit /b 0
:fail
set "CODE=%errorlevel%"
echo Build failed with exit code %CODE%.
if "%QUIET%"=="0" pause
exit /b %CODE%
