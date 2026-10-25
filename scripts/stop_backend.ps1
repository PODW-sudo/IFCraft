# Stop any IFC Editor backend process (including a zombie that still holds storage\.server.lock).
#
# Why this exists: on Windows an asyncio accept failure (WinError 64) can leave uvicorn alive
# without a listening socket. The single-writer lock is still held, so the next start refuses
# with "Another IFC Editor backend is already running". This script only targets processes whose
# command line is this app's uvicorn; it never touches unrelated Python work.
#
# Usage:
#   .\scripts\stop_backend.ps1
#   .\scripts\stop_backend.ps1 -Port 8000

param(
    [int]$Port = 8000
)

$targets = Get-CimInstance Win32_Process |
    Where-Object { $_.Name -match '^python' -and $_.CommandLine -match 'uvicorn\s+app\.main:app' }

if (-not $targets) {
    Write-Host "[INFO] No IFC Editor uvicorn process is running."
} else {
    foreach ($proc in $targets) {
        try {
            Stop-Process -Id $proc.ProcessId -Force -ErrorAction Stop
            Write-Host "[STOPPED] pid=$($proc.ProcessId)"
        } catch {
            Write-Warning "Could not stop pid=$($proc.ProcessId): $($_.Exception.Message)"
        }
    }
}

Start-Sleep -Milliseconds 500
$listener = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
if ($listener) {
    Write-Warning "Port $Port is still listening (pid=$($listener[0].OwningProcess))."
    exit 1
}

Write-Host "[OK] Port $Port is free. Start the backend with:"
Write-Host "     cd backend; .\venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000"
exit 0
