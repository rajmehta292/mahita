[CmdletBinding()]
param(
    [string]$RepoRoot = "",
    [switch]$StartNow
)

$ErrorActionPreference = "Stop"

if (-not $RepoRoot) {
    $RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\\..")).Path
}

$startupDir = [Environment]::GetFolderPath("Startup")
$webLauncher = Join-Path $startupDir "Mahita Web Supervisor.cmd"
$tunnelLauncher = Join-Path $startupDir "Mahita Tunnel Supervisor.cmd"
$webScript = Join-Path $RepoRoot "scripts\\windows\\Start-MahitaWebSupervisor.ps1"
$tunnelScript = Join-Path $RepoRoot "scripts\\windows\\Start-MahitaTunnelSupervisor.ps1"

function Write-Launcher {
    param(
        [string]$Path,
        [string]$ScriptPath
    )

    $content = @(
        "@echo off",
        "start `"`" /min powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$ScriptPath`""
    )
    Set-Content -Path $Path -Value $content -Encoding ASCII
}

foreach ($taskName in @("Mahita Web Supervisor", "Mahita Tunnel Supervisor")) {
    if (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue) {
        Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
    }
}

Write-Launcher -Path $webLauncher -ScriptPath $webScript
Write-Launcher -Path $tunnelLauncher -ScriptPath $tunnelScript

if ($StartNow) {
    Start-Process -FilePath $webLauncher -WindowStyle Hidden | Out-Null
    Start-Process -FilePath $tunnelLauncher -WindowStyle Hidden | Out-Null
}

Write-Output "Installed startup launchers:"
Write-Output " - $webLauncher"
Write-Output " - $tunnelLauncher"
