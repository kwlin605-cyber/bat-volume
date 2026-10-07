@echo off
setlocal
cd /d "%~dp0"
set "batRuntime="

if exist "%~dp0runtime\node.exe" set "batRuntime=%~dp0runtime\node.exe"
if not defined batRuntime for /f "delims=" %%N in ('"%SystemRoot%\System32\where.exe" node.exe 2^>nul') do if not defined batRuntime set "batRuntime=%%N"
if not defined batRuntime for /d %%D in ("%LOCALAPPDATA%\MumioBuildTools\node-v*") do if exist "%%~fD\node.exe" if not defined batRuntime set "batRuntime=%%~fD\node.exe"
if not defined batRuntime for /d %%D in ("%USERPROFILE%\AppData\Local\MumioBuildTools\node-v*") do if exist "%%~fD\node.exe" if not defined batRuntime set "batRuntime=%%~fD\node.exe"
if not defined batRuntime if exist "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" set "batRuntime=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if not defined batRuntime if exist "%ProgramFiles%\nodejs\node.exe" set "batRuntime=%ProgramFiles%\nodejs\node.exe"
if not defined batRuntime if exist "%LOCALAPPDATA%\Programs\nodejs\node.exe" set "batRuntime=%LOCALAPPDATA%\Programs\nodejs\node.exe"

if not defined batRuntime (
  "%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -Command "Write-Host ((Get-Content -LiteralPath 'scripts/messages.json' -Raw -Encoding UTF8 | ConvertFrom-Json).missingRuntime)"
  pause
  exit /b 1
)

"%batRuntime%" "%~dp0scripts\launch.cjs"
set "batExitCode=%errorlevel%"
if not "%batExitCode%"=="0" pause
exit /b %batExitCode%
