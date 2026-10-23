# Voltix Dynamics - clean install + verification (Windows PowerShell, Node v24)
# Run from the project root:  powershell -ExecutionPolicy Bypass -File .\setup.ps1

$ErrorActionPreference = "Continue"
Set-Location -Path $PSScriptRoot

function Fail($msg) {
  Write-Host ""
  Write-Host "FAILED: $msg" -ForegroundColor Red
  exit 1
}

Write-Host "==> 1/4  Cleaning previous artifacts" -ForegroundColor Cyan
foreach ($item in @("node_modules", ".next", "package-lock.json", ".babelrc", "tsconfig.tsbuildinfo")) {
  if (Test-Path $item) { Remove-Item $item -Recurse -Force }
}

Write-Host "==> 2/4  npm install" -ForegroundColor Cyan
npm install --legacy-peer-deps --no-audit --no-fund
if ($LASTEXITCODE -ne 0) { Fail "npm install" }

Write-Host "==> 3/4  Type check (tsc --noEmit)" -ForegroundColor Cyan
npm run typecheck
if ($LASTEXITCODE -ne 0) { Fail "typecheck reported errors" }

Write-Host "==> 4/4  Production build" -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) {
  Write-Host "Build failed. Retrying with the Babel fallback (.babelrc)..." -ForegroundColor Yellow
  # ASCII encoding avoids the UTF-8 BOM that Windows PowerShell 5.1 would add (Babel can't parse a BOM in JSON).
  Set-Content -Path ".babelrc" -Value '{"presets": ["next/babel"]}' -Encoding ascii
  if (Test-Path ".next") { Remove-Item ".next" -Recurse -Force }
  npm run build
  if ($LASTEXITCODE -ne 0) { Fail "build failed even with the Babel fallback" }
}

Write-Host ""
Write-Host "SUCCESS: typecheck + build passed. Start the dev server with:  npm run dev" -ForegroundColor Green
