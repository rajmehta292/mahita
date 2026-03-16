[CmdletBinding()]
param(
    [string]$RepoRoot = "",
    [string]$TunnelId = "84a020a6-a24f-427e-b040-80fd8c4d92ab",
    [int]$RestartDelaySeconds = 5
)

$ErrorActionPreference = "Stop"

if (-not $RepoRoot) {
    $RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\\..")).Path
}

$stdoutLog = Join-Path $RepoRoot "windows-tunnel.stdout.log"
$stderrLog = Join-Path $RepoRoot "windows-tunnel.stderr.log"
$configPath = Join-Path $RepoRoot "cloudflared\\config.yml"
$cloudflared = (Get-Command cloudflared.exe -ErrorAction SilentlyContinue).Source

if (-not $cloudflared) {
    $cloudflared = (Get-Command cloudflared -ErrorAction Stop).Source
}

function Write-SupervisorLog {
    param([string]$Message)

    $timestamp = Get-Date -Format o
    Add-Content -Path $stderrLog -Value "[$timestamp] $Message"
}

while ($true) {
    Write-SupervisorLog "Starting Cloudflare tunnel $TunnelId"
    $command = "`"$cloudflared`" tunnel --config `"$configPath`" run $TunnelId"
    $previousPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = "Continue"
        & cmd.exe /d /s /c $command 1>> $stdoutLog 2>> $stderrLog
        $exitCode = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $previousPreference
    }
    Write-SupervisorLog "Cloudflare tunnel exited with code $exitCode"
    Start-Sleep -Seconds $RestartDelaySeconds
}
