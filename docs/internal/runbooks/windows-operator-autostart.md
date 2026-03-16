---
title: Windows Operator Autostart
slug: runbooks/windows-operator-autostart
category: runbook
visibility: signed-in
audience: operators
status: Current
order: 6
updatedAt: 2026-03-15
---

# Windows operator autostart

## Goal

Keep the public app and Cloudflare tunnel running after login, and restart them automatically if either process exits.

## Startup launchers

The Windows operator machine uses two per-user Startup launchers:

- `Mahita Web Supervisor.cmd`
- `Mahita Tunnel Supervisor.cmd`

They live in the current user's Startup folder and launch hidden PowerShell supervisor processes at logon.

## Install or refresh the tasks

From `C:\mahita\mahita`:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\windows\Install-MahitaOperatorTasks.ps1
```

To install and start them immediately:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\windows\Install-MahitaOperatorTasks.ps1 -StartNow
```

## Runtime model

- `scripts/windows/Start-MahitaWebSupervisor.ps1`
  - requires an existing `.next-build` production build
  - runs `npm run start`
  - restarts the web server if it exits
- `scripts/windows/Start-MahitaTunnelSupervisor.ps1`
  - runs the `mahita` Cloudflare tunnel from `cloudflared/config.yml`
  - restarts the tunnel if it exits

## Logs

Runtime logs are written at the repo root:

- `windows-web.stdout.log`
- `windows-web.stderr.log`
- `windows-tunnel.stdout.log`
- `windows-tunnel.stderr.log`

## Health checks

After starting the tasks, verify:

```powershell
Invoke-WebRequest http://127.0.0.1:6244/api/health/auth
Invoke-WebRequest https://mahita.ai/api/health/auth
cloudflared tunnel info 84a020a6-a24f-427e-b040-80fd8c4d92ab
```

## Notes

- These launchers run from the current user's Startup folder. After a reboot, the operator must log in once.
- After pulling new code, run `npm run build` before restarting the web supervisor.
- `cloudflared/config.yml` remains local-only and must not be committed.
