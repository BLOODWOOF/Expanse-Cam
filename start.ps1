# Starts everything for a cam session. The mod runs this when camera mode turns on
# as CHUDWOLF; safe to run again while things are already running.
#   .\start.ps1           mediamtx + caddy + backend + cloudflare tunnel + OBS
#                         (the backend tells OBS when to actually stream)
#   .\start.ps1 -NoObs    everything except OBS, for testing
#   .\start.ps1 -Local    no tunnel, no relay, only viewable on this PC (dev site)
#   .\start.ps1 -NoTunnel relay on but no tunnel, for testing
param(
    [switch]$NoObs,
    [switch]$Local,
    [switch]$NoTunnel
)

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot

function Test-Running($name) { [bool](Get-Process $name -ErrorAction SilentlyContinue) }

# passwords and keys live in a file git ignores, made on first run
$secrets = Join-Path $root 'server\secrets.yml'
if (-not (Test-Path $secrets)) {
    $pass = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 24 | ForEach-Object { [char]$_ })
    Set-Content $secrets "publishPass: $pass`r`nturnKeyId: `r`nturnApiToken: `r`nobsWsPass: `r`nworkerUrl: `r`nworkerKey: " -Encoding ascii
    Write-Host "Made $secrets - put obs:<publishPass> in OBS as the Bearer Token"
}
$secretText = Get-Content $secrets -Raw
function Read-Secret($name) {
    [regex]::Match($secretText, "(?m)^${name}:[ \t]*(\S+)").Groups[1].Value
}
$pass = Read-Secret 'publishPass'
if (-not $pass) { throw "No publishPass in $secrets" }

if (-not (Test-Running mediamtx)) {
    if ($Local) {
        $iceServers = @()
        $extraHosts = '["127.0.0.1"]'
    } else {
        $keyId = Read-Secret 'turnKeyId'
        $token = Read-Secret 'turnApiToken'
        if (-not $keyId -or -not $token) { throw "Fill in turnKeyId and turnApiToken in $secrets (or use -Local)" }

        # fresh relay login, good for 48 h (Cloudflare's max)
        $res = Invoke-RestMethod -Method Post -Uri "https://rtc.live.cloudflare.com/v1/turn/keys/$keyId/credentials/generate-ice-servers" `
            -Headers @{ Authorization = "Bearer $token" } -ContentType 'application/json' -Body '{"ttl": 172800}'
        $iceServers = foreach ($s in $res.iceServers) {
            foreach ($url in @($s.urls)) {
                # only TLS relay entries. stun:, and plain turn: over UDP, let MediaMTX look up
                # the public IP and hand it to viewers
                if ($url -notlike 'turns:*') { continue }
                [ordered]@{ url = $url; username = $s.username; password = $s.credential }
            }
        }
        if (-not $iceServers) { throw 'Cloudflare returned no TURN servers' }
        # MediaMTX won't start with no host at all; 127.0.0.1 tells a viewer nothing
        $extraHosts = '["127.0.0.1"]'
    }

    $conf = (Get-Content (Join-Path $root 'server\mediamtx.yml') -Raw).
        Replace('{{PUBLISH_PASS}}', $pass).
        Replace('{{EXTRA_HOSTS}}', $extraHosts).
        Replace('{{ICE_SERVERS}}', (ConvertTo-Json @($iceServers) -Compress))
    $runConf = Join-Path $root 'tools\mediamtx\run.yml'
    [IO.File]::WriteAllText($runConf, $conf)

    Start-Process (Join-Path $root 'tools\mediamtx\mediamtx.exe') -ArgumentList "`"$runConf`"" -WorkingDirectory (Join-Path $root 'tools\mediamtx') -WindowStyle Minimized
}

if (-not (Test-Running caddy)) {
    $env:DEV_SITE_DIR = Join-Path $root 'site-dev'
    Start-Process (Join-Path $root 'tools\caddy\caddy.exe') -ArgumentList 'run', '--config', "`"$(Join-Path $root 'server\Caddyfile')`"", '--adapter', 'caddyfile' -WorkingDirectory $root -WindowStyle Minimized
}

$backend = Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -like '*backend.mjs*' }
if (-not $backend) {
    $data = Join-Path $root 'data'
    New-Item -ItemType Directory -Force $data | Out-Null
    Start-Process node -ArgumentList "`"$(Join-Path $root 'server\backend.mjs')`"" -WorkingDirectory $root -WindowStyle Hidden `
        -RedirectStandardOutput (Join-Path $data 'backend.log') -RedirectStandardError (Join-Path $data 'backend.err.log')
}

if (-not $Local -and -not $NoTunnel) {
    # Cloudflare quick tunnel to Caddy. Its address changes every start, so it gets handed to
    # the Worker, which is where the page on GitHub Pages looks it up.
    $workerUrl = Read-Secret 'workerUrl'
    $workerKey = Read-Secret 'workerKey'
    if (-not $workerUrl -or -not $workerKey) { throw "Fill in workerUrl and workerKey in $secrets (or use -NoTunnel)" }

    $tunnelLog = Join-Path $root 'data\cloudflared.log'
    # only our copy counts, not a cloudflared installed as a Windows service
    $cloudflared = Join-Path $root 'tools\cloudflared.exe'
    $ours = Get-Process cloudflared -ErrorAction SilentlyContinue | Where-Object { $_.Path -eq $cloudflared }
    if (-not $ours) {
        New-Item -ItemType Directory -Force (Split-Path $tunnelLog) | Out-Null
        Remove-Item $tunnelLog -ErrorAction SilentlyContinue
        Start-Process $cloudflared -WindowStyle Hidden `
            -ArgumentList 'tunnel', '--no-autoupdate', '--url', 'http://localhost:8080', '--logfile', "`"$tunnelLog`""
    }

    $tunnelUrl = $null
    for ($i = 0; $i -lt 60 -and -not $tunnelUrl; $i++) {
        Start-Sleep -Milliseconds 500
        $text = Get-Content $tunnelLog -Raw -ErrorAction SilentlyContinue
        $m = [regex]::Matches("$text", 'https://[a-z0-9-]+\.trycloudflare\.com')
        if ($m.Count) { $tunnelUrl = $m[$m.Count - 1].Value }
    }
    if (-not $tunnelUrl) { throw "cloudflared didn't report a tunnel address, see $tunnelLog" }

    Invoke-RestMethod -Method Put -Uri $workerUrl -Headers @{ Authorization = "Bearer $workerKey" } `
        -ContentType 'application/json' -Body (@{ url = $tunnelUrl } | ConvertTo-Json -Compress) | Out-Null
    Write-Host "Tunnel: $tunnelUrl"
}

if (-not $NoObs -and -not (Test-Running obs64)) {
    $obsDir = 'C:\Program Files\obs-studio\bin\64bit'
    # Not --minimize-to-tray: OBS in the tray ignores close requests, so stop.ps1 would have
    # to kill it and OBS would offer safe mode next time. Minimized to the taskbar closes fine.
    $obs = Start-Process (Join-Path $obsDir 'obs64.exe') -WorkingDirectory $obsDir -PassThru
    Add-Type -Namespace ExpanseCam -Name Win -MemberDefinition '[DllImport("user32.dll")] public static extern bool ShowWindow(System.IntPtr h, int cmd);'
    for ($i = 0; $i -lt 40 -and $obs.MainWindowHandle -eq 0; $i++) {
        Start-Sleep -Milliseconds 250
        $obs.Refresh()
    }
    # 7 = minimize without taking focus from Minecraft
    if ($obs.MainWindowHandle -ne 0) { [ExpanseCam.Win]::ShowWindow($obs.MainWindowHandle, 7) | Out-Null }
}

Write-Host 'Page: https://bloodwoof.github.io/Expanse-Cam/  dev: http://127.0.0.1:8082/  ads: http://localhost:8081/'
