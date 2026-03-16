---
title: Cloudflare Tunnel Recovery
slug: runbooks/cloudflare-tunnel-recovery
category: runbook
visibility: signed-in
audience: operators
status: Current
order: 5
updatedAt: 2026-03-11
---

# Cloudflare tunnel recovery

## Symptom

`mahita.ai` returns Cloudflare `1033`.

## Meaning

The public hostname is up at Cloudflare, but the local tunnel process is not currently reachable.

## Recovery

1. verify local app health on `http://127.0.0.1:6244`
2. restart `cloudflared`
3. recheck `https://mahita.ai/api/health/auth`
4. retry public callback flows only after the public health route is reachable

## Preferred steady state

Do not rely on an ad hoc terminal for the public tunnel. The operator machine should run:

- `Mahita Web Supervisor.cmd`
- `Mahita Tunnel Supervisor.cmd`

See [Windows operator autostart](./windows-operator-autostart.md).

## Presentation rule

Do not start a live demo on the public hostname unless the health endpoint is already green.
