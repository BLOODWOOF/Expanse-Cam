# Stops what start.ps1 started (leaves Minecraft alone) and puts the maintenance page
# on the public link. The mod runs this 6 min after leaving the server, or on quitting.

# Stop the stream first, OBS asks "are you sure?" if you close it mid-stream.
# The backend stops it, ignores the mod from then on, answers once OBS says it's stopped, then exits.
try {
    Invoke-RestMethod -Method Post -Uri 'http://127.0.0.1:8081/admin/stop' -TimeoutSec 15 | Out-Null
} catch {
    # backend already gone, so nothing is telling OBS to stream
}

# Ask OBS to close like clicking X (works from the tray too). Killing it outright makes
# OBS think it crashed and offer safe mode next time.
$obs = Get-Process obs64 -ErrorAction SilentlyContinue
if ($obs) {
    taskkill /PID $obs.Id 2>$null | Out-Null
    if (-not $obs.WaitForExit(15000)) {
        Stop-Process -Id $obs.Id -Force
    }
}

foreach ($name in 'caddy', 'mediamtx') {
    Get-Process $name -ErrorAction SilentlyContinue | Stop-Process
}
Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
    Where-Object { $_.CommandLine -like '*backend.mjs*' } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -ErrorAction SilentlyContinue }

$tailscale = (Get-Command tailscale -ErrorAction SilentlyContinue).Source
if (-not $tailscale) { $tailscale = 'C:\Program Files\Tailscale\tailscale.exe' }
if (Test-Path $tailscale) {
    # Tailscale serves the page itself, so it works with nothing else running.
    # Serving a folder needs admin on Windows, so it goes through the task that
    # server\setup-maintenance-task.ps1 registers. Plain text if that's missing.
    if (Get-ScheduledTask -TaskName 'ExpanseCam maintenance page' -ErrorAction SilentlyContinue) {
        Start-ScheduledTask -TaskName 'ExpanseCam maintenance page'
    } else {
        & $tailscale funnel --bg "text:Stream's down for maintenance. Check back later." | Out-Null
    }
}
