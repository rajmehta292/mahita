[CmdletBinding()]
param(
    [string]$RepoRoot = "",
    [int]$RestartDelaySeconds = 5,
    [int]$MissingBuildRetryDelaySeconds = 30
)

$ErrorActionPreference = "Stop"

if (-not $RepoRoot) {
    $RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\\..")).Path
}

$stdoutLog = Join-Path $RepoRoot "windows-web.stdout.log"
$stderrLog = Join-Path $RepoRoot "windows-web.stderr.log"
$buildDir = Join-Path $RepoRoot ".next-build"
$buildIdPath = Join-Path $buildDir "BUILD_ID"

function Write-SupervisorLog {
    param([string]$Message)

    $timestamp = Get-Date -Format o
    Add-Content -Path $stderrLog -Value "[$timestamp] $Message"
}

function Invoke-LoggedCommand {
    param([string]$Command)

    Push-Location $RepoRoot
    $previousPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = "Continue"
        & cmd.exe /d /s /c $Command 1>> $stdoutLog 2>> $stderrLog
        return $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $previousPreference
        Pop-Location
    }
}

while ($true) {
    if (-not (Test-Path $buildIdPath)) {
        Write-SupervisorLog "Missing production build at $buildIdPath. Run npm run build, then restart the task."
        Start-Sleep -Seconds $MissingBuildRetryDelaySeconds
        continue
    }

    Write-SupervisorLog "Starting production web server"
    $exitCode = Invoke-LoggedCommand "npm run start"
    Write-SupervisorLog "Production web server exited with code $exitCode"
    Start-Sleep -Seconds $RestartDelaySeconds
}
