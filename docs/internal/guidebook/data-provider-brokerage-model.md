---
title: Data, Provider, and Brokerage Model
slug: guidebook/data-provider-brokerage-model
category: guidebook
visibility: signed-in
audience: developers
status: Current
order: 2
updatedAt: 2026-03-11
---

# Data, provider, and brokerage model

## Current conceptual split

### User brokerage authority

This is the user-owned side of the system:

- `SchwabConfig`
- `BrokerageConnection`
- `BrokerageAccount`

These models exist to represent a user’s own brokerage relationship with Mahita.

### Platform authority

This is the Mahita-operated side of the system:

- `ProviderCredential`
- `ProviderPoolMember`

These models exist to represent credentials used by Mahita itself for shared platform operations.

## Why the split matters

The system must never silently reuse a customer’s brokerage credentials for general platform data operations. That is the core trust boundary.

## Current transitional reality

There is still a temporary superuser-backed bridge for market-data purposes. It is documented and intentional, but it is not the enterprise-final design.

## Future replacement

The temporary bridge should be replaced by dedicated provider credentials managed through the control plane.
