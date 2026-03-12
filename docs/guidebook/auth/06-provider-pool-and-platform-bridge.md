# 06 - Provider Pool And Platform Bridge

## Why This Exists
Mahita has two different external-access planes:
- **user brokerage plane**
  - customer-owned Schwab connections for positions, balances, orders
- **platform provider plane**
  - platform-owned credentials for shared market-data ingestion and jobs

These must eventually be fully separate.

## Current State
The schema already includes:
- `ProviderCredential`
- `ProviderPoolMember`

But the platform still supports a temporary bridge:
- a superuser can explicitly promote one connected Schwab bridge into the provider pool for local/platform fallback

## Why The Bridge Is Transitional
This bridge is safer than the old implicit fallback because it is:
- explicit
- visible in admin
- auditable

But it is not enterprise-final because a user-owned brokerage authorization is still being used as platform infrastructure.

## Planned End State
- dedicated platform provider credentials only
- no user brokerage token usable by platform jobs
- provider pool lifecycle fully controlled in admin
