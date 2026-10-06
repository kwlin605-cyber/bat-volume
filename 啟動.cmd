@echo off
setlocal
cd /d "%~dp0"
"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -Command "$batRuntime = (Get-Command node -ErrorAction SilentlyContinue).Source; if (-not $batRuntime) { $batRuntime = Get-ChildItem -LiteralPath (Join-Path $env:LOCALAPPDATA 'MumioBuildTools') -Filter 'node-v*' -Directory -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | ForEach-Object { Join-Path $_.FullName 'node.exe' } | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1 }; if (-not $batRuntime) { Write-Host ((Get-Content -LiteralPath 'scripts/messages.json' -Raw | ConvertFrom-Json).missingRuntime); exit 1 }; & $batRuntime 'scripts/launch.cjs'; exit $LASTEXITCODE"
if errorlevel 1 pause
