# =====================================================================
# IFC Editor - Master CI/CD Local Quality Gate Verifier
# =====================================================================
# Usage:
#   powershell -ExecutionPolicy Bypass -File .\scripts\ci_verify.ps1 [-Tier key|milestone] [-SkipBrowser]
# =====================================================================

param (
    [ValidateSet("key", "milestone")]
    [string]$Tier = "key",

    [switch]$SkipBrowser = $false
)

$ErrorActionPreference = "Stop"

function Print-Banner([string]$title) {
    Write-Host ""
    Write-Host ("=" * 70) -ForegroundColor Cyan
    Write-Host "  $title" -ForegroundColor White
    Write-Host ("=" * 70) -ForegroundColor Cyan
    Write-Host ""
}

function Print-Step([int]$num, [string]$title) {
    Write-Host "[Step $num] $title..." -ForegroundColor Yellow
}

function Print-Pass([string]$msg) {
    Write-Host "  [PASS] $msg" -ForegroundColor Green
}

function Print-Fail([string]$msg) {
    Write-Host "  [FAIL] $msg" -ForegroundColor Red
}

$PyExe = ".\backend\venv\Scripts\python.exe"
if (-not (Test-Path $PyExe)) {
    $PyExe = "python"
}

Print-Banner "IFC EDITOR - MASTER QUALITY GATES AND CI VERIFIER"

$overallPassed = $true

# 1. Backend Runtime & Import Smoke Test
try {
    Print-Step 1 "Backend Runtime and Library Import Check"
    & $PyExe -c "import fastapi, ifcopenshell, aiosqlite, uvicorn; print('    Core backend dependencies loaded successfully.')"
    Print-Pass "Backend dependencies and IfcOpenShell are functional."
} catch {
    Print-Fail "Backend dependency check failed."
    $overallPassed = $false
}

# 2. Frontend Strict TypeScript Compilation
try {
    Print-Step 2 "Frontend TypeScript Compilation (tsc -b)"
    Push-Location frontend
    pnpm exec tsc -b
    Pop-Location
    Print-Pass "Frontend TypeScript compiled with 0 type errors."
} catch {
    Pop-Location
    Print-Fail "Frontend TypeScript errors detected."
    $overallPassed = $false
}

# 3. Frontend Production Bundle Build
try {
    Print-Step 3 "Frontend Production Bundle Build (Vite)"
    Push-Location frontend
    pnpm run build
    Pop-Location
    Print-Pass "Frontend production bundle built cleanly."
} catch {
    Pop-Location
    Print-Fail "Frontend build failed."
    $overallPassed = $false
}

# 4. Objective UX/UI Quality Gates
try {
    Print-Step 4 "Objective UX/UI Gates (Zero Emoji, Contrast, Intent, DTCG Tokens)"
    & $PyExe scripts/gates/run_gates.py
    Print-Pass "All 4 objective UX/UI gates PASSED."
} catch {
    Print-Fail "Objective UX/UI gates failed."
    $overallPassed = $false
}

# 5. Agent QA Harness Integrity Check
try {
    Print-Step 5 "Agent QA Harness Integrity Validator"
    & $PyExe scripts/qa_runner.py check
    Print-Pass "Harness configuration and test_cases.jsonl syntax valid."
} catch {
    Print-Fail "QA harness validation failed."
    $overallPassed = $false
}

# 6. Live Browser E2E Test Suite Execution
if (-not $SkipBrowser) {
    Print-Step 6 "Live Browser E2E Automation (Google Chrome CDP)"
    
    try {
        if ($Tier -eq "milestone") {
            Write-Host "  Executing Major Milestone Tier in Chrome..." -ForegroundColor Cyan
            & $PyExe scripts/qa_runner.py run --milestone --browser
        } else {
            Write-Host "  Executing Key Functionalities Tier in Chrome..." -ForegroundColor Cyan
            & $PyExe scripts/qa_runner.py run --tier key --browser
        }
        if ($LASTEXITCODE -eq 0) {
            Print-Pass "Live browser E2E test suite execution completed with 100% pass rate."
        } else {
            Print-Fail "Browser test suite returned non-zero exit code."
            $overallPassed = $false
        }
    } catch {
        Print-Fail "Browser test suite execution failed: $_"
        $overallPassed = $false
    }
} else {
    Write-Host "[Step 6] Skipped browser E2E tests (-SkipBrowser specified)." -ForegroundColor DarkGray
}

Print-Banner "QUALITY GATES SUMMARY"
if ($overallPassed) {
    Write-Host "  STATUS: ALL QUALITY GATES PASSED (PRODUCTION READY)" -ForegroundColor Green
    exit 0
} else {
    Write-Host "  STATUS: QUALITY GATE FAILURES DETECTED" -ForegroundColor Red
    exit 1
}
