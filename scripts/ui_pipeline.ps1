# =====================================================================
# IFC Editor - Single Command UI Pipeline Launcher (PowerShell)
# =====================================================================
# Usage:
#   .\scripts\ui_pipeline.ps1                 # Standard run
#   .\scripts\ui_pipeline.ps1 -Tier quick     # Fast static & gates check
#   .\scripts\ui_pipeline.ps1 -Browser        # Live browser E2E test run
#   .\scripts\ui_pipeline.ps1 -Milestone      # full 372 tests milestone audit
# =====================================================================

param (
    [ValidateSet("quick", "key", "milestone")]
    [string]$Tier = "key",

    [switch]$Browser = $false,
    [switch]$Milestone = $false,
    [switch]$SkipLayout = $false
)

$PyExe = ".\backend\venv\Scripts\python.exe"
if (-not (Test-Path $PyExe)) {
    $PyExe = "python"
}

$argsList = @("scripts/ui_pipeline.py", "--tier", $Tier)

if ($Browser) {
    $argsList += "--browser"
}

if ($Milestone) {
    $argsList += "--milestone"
}

if ($SkipLayout) {
    $argsList += "--skip-layout"
}

& $PyExe @argsList
exit $LASTEXITCODE
