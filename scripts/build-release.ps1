# rprint Windows Release Build Script
# Build Windows installers (MSI and NSIS)

$ErrorActionPreference = "Stop"

# Set Rust/Cargo path
$env:PATH = "C:\Users\Administrator\.cargo\bin;" + $env:PATH

Write-Host "Building rprint release..." -ForegroundColor Cyan

# Navigate to project directory
Set-Location (Split-Path -Parent $PSScriptRoot)

# Build frontend first
Write-Host "`nBuilding frontend..." -ForegroundColor Yellow
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host "Frontend build failed!" -ForegroundColor Red
    exit 1
}

# Build Tauri release
Write-Host "`nBuilding Tauri release (this may take a few minutes)..." -ForegroundColor Yellow
npx tauri build

if ($LASTEXITCODE -ne 0) {
    Write-Host "Tauri build failed!" -ForegroundColor Red
    exit 1
}

Write-Host "`nBuild completed successfully!" -ForegroundColor Green
Write-Host "Installers are located in: src-tauri\target\release\bundle\" -ForegroundColor Cyan
