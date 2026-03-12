# Desktop Expansion Spec

Status: Planned. This document describes the target desktop architecture. It does not imply that desktop helper integration exists in the current release.

## Objective
Provide a future desktop-assisted Mahita experience with:
- faster chart and backtest access
- encrypted local Mahita data cache
- separate user-readable Schwab export/download folder
- richer multi-window workflows
- optional helper detection from a desktop shell

## Product Surface In Current Web App
- Add a sidebar entry named `Desktop Expansion` as the final nav item.
- The page explains:
  - what the desktop expansion will provide
  - what is and is not available in the current web release
  - how encrypted Mahita cache differs from user-readable exports

## Future Desktop Stack
- .NET MAUI desktop app
- bundled local helper service
- optional local RPC bridge between web shell and helper

## Folder Model

### 1. Encrypted Mahita cache
Purpose:
- local performance cache for charts, backtests, and downloaded reference data

Rules:
- stored as opaque encrypted artifacts
- not user-browsable for raw market data access
- keys managed by the desktop app/helper, not by exposed user-facing file names alone

### 2. User-readable Schwab export folder
Purpose:
- give the user a normal folder containing readable exports they explicitly download

Formats:
- CSV
- JSON
- Parquet
- Mahita-native bundle where relevant

## Security Model
- Local encrypted cache is performance infrastructure, not a customer-facing storage browser.
- User-readable exports are written separately from the encrypted cache.
- User Schwab credentials remain user-scoped and are never repurposed as shared market-data pool credentials.
- Admin access to secrets remains an audited break-glass workflow; desktop expansion does not weaken that boundary.

## Protocol Outline
- Desktop helper registers local status/health.
- Web shell can detect helper availability when running inside desktop context.
- Helper exposes only the minimal RPC surface needed for:
  - cache health
  - export destination status
  - optional local artifact hydration

## Not In Scope For Current Web Release
- required local folder binding
- mandatory desktop-only workflows
- fake helper controls without a real helper implementation
