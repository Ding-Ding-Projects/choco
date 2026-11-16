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
rem The release workflow builds with Node.js 22. Newer versions break the unpacking of Electron during
rem npm ci, so a Node.js other than 22 on the PATH is not used: a portable Node.js 22 is used instead.
set "NODE_MAJOR="
for /f %%v in ('node -p "process.versions.node.split(/[.]/)[0]" 2^>nul') do set "NODE_MAJOR=%%v"
if not "!NODE_MAJOR!"=="22" (
  if defined NODE_MAJOR ( echo   Node.js !NODE_MAJOR! is on the PATH; this build uses Node.js 22. )
  set "NODE_DIR=%LOCALAPPDATA%\MaterialChocoBuild\node-v22.12.0-win-x64"
  if not exist "!NODE_DIR!\node.exe" (
    echo   Downloading portable Node.js 22 to %LOCALAPPDATA%\MaterialChocoBuild and checking its SHA-256
    powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; $d=Join-Path $env:LOCALAPPDATA 'MaterialChocoBuild'; New-Item -ItemType Directory -Force $d | Out-Null; $z=Join-Path $d 'node.zip'; Invoke-WebRequest 'https://nodejs.org/dist/v22.12.0/node-v22.12.0-win-x64.zip' -OutFile $z; if ((Get-FileHash $z -Algorithm SHA256).Hash -ne '2b8f2256382f97ad51e29ff71f702961af466c4616393f767455501e6aece9b8') { Remove-Item $z; throw 'The Node.js download does not match its published SHA-256.' }; Expand-Archive $z -DestinationPath $d -Force; Remove-Item $z" || goto :fail
  )
  set "PATH=!NODE_DIR!;!PATH!"
)
node --version || goto :fail

echo [2/5] Chocolatey CLI from this repository
if not exist "choco-bundle\choco.exe" (
  rem The CLI build takes a tag on the current commit as its version. Release tags such as
  rem material-choco-v0.1.16 are not version numbers, so a tagged commit is built from a local
  rem copy without tags, in a folder this script owns. The folder name is short because the CLI
  rem build writes test files whose paths are close to the 260 character Windows limit.
  set "CLI_SRC=%~dp0.."
  set "HEAD_TAGGED="
  for /f "delims=" %%t in ('git -C "%~dp0.." tag -l --points-at HEAD 2^>nul') do set "HEAD_TAGGED=1"
  if defined HEAD_TAGGED (
    set "CLI_SRC=%LOCALAPPDATA%\mcb"
    echo   This commit carries a release tag. Building the CLI from a copy without tags in !CLI_SRC!
    if exist "!CLI_SRC!\.material-choco-cli-src" rmdir /s /q "!CLI_SRC!"
    if exist "!CLI_SRC!" ( echo   !CLI_SRC! exists and was not made by this script. Remove it and run again. & goto :fail )
    git clone --quiet --no-tags --local "%~dp0.." "!CLI_SRC!" || goto :fail
    type nul > "!CLI_SRC!\.material-choco-cli-src"
  )
  rem Started from PowerShell 7, the CLI build's Windows PowerShell would inherit PowerShell 7's module
  rem path and fail to load PackageManagement. Cleared, Windows PowerShell builds its own default path.
  set "PSModulePath="
  pushd "!CLI_SRC!"
  rem The app needs choco.exe only. Packing the CLI into .nupkg files is skipped: on a local main
  rem checkout its package version comes out as "2.x.y-", which choco pack refuses.
  call "!CLI_SRC!\build.bat" --target=CI --testExecutionType=unit --shouldRunOpenCover=false --shouldBuildMsi=false --shouldRunChocolatey=false --shouldRunNuGet=false || (popd & goto :fail)
  popd
  powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; $e=Get-ChildItem '!CLI_SRC!\code_drop' -Recurse -Filter choco.exe | Sort-Object { if ($_.FullName -match 'choco_merged') {0} elseif ($_.FullName -match '_PublishedApps') {1} else {2} } | Select-Object -First 1; if (-not $e) { throw 'choco.exe was not produced' }; New-Item -ItemType Directory -Force choco-bundle | Out-Null; Copy-Item (Join-Path $e.DirectoryName '*') choco-bundle -Recurse -Force" || goto :fail
) else ( echo   Using the existing choco-bundle folder )

echo [3/5] Schema from the CLI source
call node scripts\gen-schema.mjs || goto :fail
echo [4/5] npm packages, UI bundle and schema check (scripts\fetch-deps.mjs)
call node scripts\fetch-deps.mjs || goto :fail
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
