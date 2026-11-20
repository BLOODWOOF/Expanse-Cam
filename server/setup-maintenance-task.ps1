# One time, as admin: registers a task that points the Funnel at server\maintenance.
# Serving a folder needs admin on Windows; stop.ps1 just triggers this task.
#Requires -RunAsAdministrator

$folder = Join-Path $PSScriptRoot 'maintenance'
$tailscale = 'C:\Program Files\Tailscale\tailscale.exe'

$action = New-ScheduledTaskAction -Execute $tailscale -Argument "funnel --bg `"$folder`""
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Minutes 1)

Register-ScheduledTask -TaskName 'ExpanseCam maintenance page' -Action $action -Principal $principal -Settings $settings -Force | Out-Null
Write-Host 'Registered "ExpanseCam maintenance page"'
