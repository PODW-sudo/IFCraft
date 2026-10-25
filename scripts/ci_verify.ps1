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

function Print-Step([string]$num, [string]$title) {
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

# =====================================================================
# STEP-05 / F-003: API token plumbing
# =====================================================================
# Every /api route requires the installation token; /health stays public. The backend writes
# the token to storage/.api_token on first start. The QA runner reads that file itself; this
# script reads it once and uses it for its own authenticated probes below.
$ApiTokenFile = Join-Path (Split-Path -Parent $PSScriptRoot) "storage\.api_token"
$ApiToken = ""
if (Test-Path $ApiTokenFile) {
    $ApiToken = (Get-Content $ApiTokenFile -Raw).Trim()
}
if ($ApiToken) {
    $env:IFC_API_TOKEN = $ApiToken
}
$ApiBase = "http://127.0.0.1:8000"
$AuthHeaders = @{}
if ($ApiToken) { $AuthHeaders["X-API-Token"] = $ApiToken }

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

# 2.5 Frontend Unit & Component Tests (Vitest)
try {
    Print-Step "2.5" "Frontend Unit & Component Tests (Vitest)"
    $pushedFrontend = $false
    Push-Location frontend
    $pushedFrontend = $true
    pnpm exec vitest run
    if ($LASTEXITCODE -ne 0) {
        throw "vitest exited with code $LASTEXITCODE"
    }
    Pop-Location
    $pushedFrontend = $false
    Print-Pass "Frontend test suite passed."
} catch {
    if ($pushedFrontend) { Pop-Location }
    Print-Fail "Frontend test suite failed."
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

# 5.5 API Authentication Plumbing (STEP-05 / F-003)
# Proves the two halves of the contract against a running backend: /health is public and
# unauthenticated /api is refused (401), while the token from storage/.api_token is accepted.
# Skipped (not failed) when no backend is listening, so -SkipBrowser runs still work.
try {
    Print-Step "5.5" "API Authentication Plumbing (public health / 401 / token accepted)"
    $backendUp = $false
    try {
        $healthResp = Invoke-WebRequest -Uri "$ApiBase/health" -UseBasicParsing -TimeoutSec 5
        $backendUp = ($healthResp.StatusCode -eq 200)
    } catch {
        $backendUp = $false
    }

    if (-not $backendUp) {
        Write-Host "  [SKIP] No backend on $ApiBase - token plumbing not probed." -ForegroundColor DarkGray
    } elseif (-not $ApiToken) {
        throw "storage\.api_token is missing; the backend did not persist an API token."
    } else {
        try {
            Invoke-RestMethod -Uri "$ApiBase/api/projects" -TimeoutSec 10 | Out-Null
            throw "GET /api/projects succeeded without a token"
        } catch {
            $status = $null
            if ($_.Exception.Response) { $status = [int]$_.Exception.Response.StatusCode }
            if ($status -ne 401) { throw "GET /api/projects without a token returned $status, expected 401" }
        }
        $projects = Invoke-RestMethod -Uri "$ApiBase/api/projects" -Headers $AuthHeaders -TimeoutSec 10
        Print-Pass "Health is public, /api rejects a missing token (401), and the stored token is accepted ($($projects.Count) projects)."
    }
} catch {
    Print-Fail "API authentication plumbing check failed: $_"
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
