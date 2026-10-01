# ==============================================================================
# IFC Editor — Unified Local Development Runner
# Starts FastAPI backend (port 8000) and Vite frontend (port 5173)
# ==============================================================================

$ErrorActionPreference = "Stop"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  IFC Editor — Starting Local Development Environment" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

$RootDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$BackendDir = Join-Path $RootDir "backend"
$FrontendDir = Join-Path $RootDir "frontend"
$PythonExe = Join-Path $BackendDir "venv\Scripts\python.exe"

# 1. Verify Backend Python Environment
if (-not (Test-Path $PythonExe)) {
    Write-Host "[Error] Python virtual environment not found at: $PythonExe" -ForegroundColor Red
    Write-Host "Please create the venv with: python -m venv backend\venv" -ForegroundColor Yellow
    exit 1
}

Write-Host "[1/3] Backend Python Environment verified." -ForegroundColor Green

# 2. Verify Frontend Dependencies
if (Test-Path (Join-Path $FrontendDir "package.json")) {
    if (-not (Test-Path (Join-Path $FrontendDir "node_modules"))) {
        Write-Host "[2/3] Installing frontend dependencies with pnpm..." -ForegroundColor Yellow
        Push-Location $FrontendDir
        pnpm install
        Pop-Location
    } else {
        Write-Host "[2/3] Frontend node_modules verified." -ForegroundColor Green
    }
} else {
    Write-Host "[2/3] Frontend not yet scaffolded (Phase 2 will initialize frontend)." -ForegroundColor Gray
}

# 3. Launch Backend and Frontend
Write-Host "[3/3] Launching Backend on http://127.0.0.1:8000..." -ForegroundColor Cyan

$BackendJob = Start-Job -ScriptBlock {
    param($python, $root)
    Set-Location $root
    & $python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload
} -ArgumentList $PythonExe, $RootDir

Write-Host "Backend process running (Job ID: $($BackendJob.Id))." -ForegroundColor Green

if (Test-Path (Join-Path $FrontendDir "package.json")) {
    Write-Host "Launching Frontend on http://localhost:5173..." -ForegroundColor Cyan
    $FrontendJob = Start-Job -ScriptBlock {
        param($dir)
        Set-Location $dir
        pnpm run dev
    } -ArgumentList $FrontendDir
    Write-Host "Frontend process running (Job ID: $($FrontendJob.Id))." -ForegroundColor Green
} else {
    $FrontendJob = $null
}

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Green
Write-Host "  IFC Editor is running!" -ForegroundColor Green
Write-Host "  - Backend API:  http://127.0.0.1:8000" -ForegroundColor White
Write-Host "  - Swagger Docs: http://127.0.0.1:8000/docs" -ForegroundColor White
if ($FrontendJob) {
    Write-Host "  - Frontend UI:  http://localhost:5173" -ForegroundColor White
}
Write-Host "  Press Ctrl+C to stop all services." -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Green

try {
    while ($true) {
        # Check backend job status
        if ($BackendJob.State -ne "Running") {
            Write-Host "[Backend stopped]" -ForegroundColor Red
            Receive-Job $BackendJob
            break
        }
        if ($FrontendJob -and $FrontendJob.State -ne "Running") {
            Write-Host "[Frontend stopped]" -ForegroundColor Red
            Receive-Job $FrontendJob
            break
        }
        Start-Sleep -Seconds 2
    }
}
finally {
    Write-Host "`nStopping background services..." -ForegroundColor Yellow
    if ($BackendJob) { Stop-Job $BackendJob; Remove-Job $BackendJob }
    if ($FrontendJob) { Stop-Job $FrontendJob; Remove-Job $FrontendJob }
    Write-Host "Services stopped cleanly." -ForegroundColor Gray
}
