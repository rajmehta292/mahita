[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"

$startupDir = [Environment]::GetFolderPath("Startup")
$launcherPaths = @(
    (Join-Path $startupDir "Mahita Web Supervisor.cmd"),
    (Join-Path $startupDir "Mahita Tunnel Supervisor.cmd")
)

$taskNames = @(
    "Mahita Web Supervisor",
    "Mahita Tunnel Supervisor"
)

foreach ($launcherPath in $launcherPaths) {
    if (Test-Path $launcherPath) {
        Remove-Item $launcherPath -Force
        Write-Output "Removed $launcherPath"
    }
}

foreach ($taskName in $taskNames) {
    if (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue) {
        Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
        Write-Output "Removed $taskName"
    }
}
