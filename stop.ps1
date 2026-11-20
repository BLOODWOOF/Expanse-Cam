# Stops what start.ps1 started (leaves Minecraft alone). The page on GitHub Pages then shows
# the maintenance view by itself. The mod runs this 6 min after leaving the server, or on quitting.

$root = $PSScriptRoot

# Tell the Worker nothing's running, so pages switch to maintenance straight away
$secrets = Join-Path $root 'server\secrets.yml'
if (Test-Path $secrets) {
    $secretText = Get-Content $secrets -Raw
    $workerUrl = [regex]::Match($secretText, "(?m)^workerUrl:[ \t]*(\S+)").Groups[1].Value
    $workerKey = [regex]::Match($secretText, "(?m)^workerKey:[ \t]*(\S+)").Groups[1].Value
    if ($workerUrl -and $workerKey) {
        try {
            Invoke-RestMethod -Method Delete -Uri $workerUrl -Headers @{ Authorization = "Bearer $workerKey" } -TimeoutSec 10 | Out-Null
        } catch {
            # offline or the Worker's down; pages notice the tunnel's gone anyway
        }
    }
}

# Stop the stream first, OBS asks "are you sure?" if you close it mid-stream.
# The backend stops it, ignores the mod from then on, answers once OBS says it's stopped, then exits.
try {
    Invoke-RestMethod -Method Post -Uri 'http://127.0.0.1:8081/admin/stop' -TimeoutSec 15 | Out-Null
} catch {
    # backend already gone, so nothing is telling OBS to stream
}

# Ask OBS to close like clicking X. Killing it outright makes OBS think it crashed and
# offer safe mode next time.
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
# our tunnel only, never a cloudflared installed as a Windows service
Get-Process cloudflared -ErrorAction SilentlyContinue |
    Where-Object { $_.Path -eq (Join-Path $root 'tools\cloudflared.exe') } |
    Stop-Process
Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
    Where-Object { $_.CommandLine -like '*backend.mjs*' } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -ErrorAction SilentlyContinue }
