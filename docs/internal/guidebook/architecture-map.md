---
title: Architecture Map
slug: guidebook/architecture-map
category: guidebook
visibility: signed-in
audience: developers
status: Current
order: 7
updatedAt: 2026-03-11
---

# Architecture map

## Identity layer

Google and NextAuth establish Mahita identity.

## Session layer

JWT-backed session data carries the Mahita user ID and role.

## Authorization layer

Protected routes require sign-in, and role/ownership checks are enforced server-side.

## Brokerage authorization layer

Schwab OAuth is separate from Mahita identity and attaches brokerage authorization to a `BrokerageConnection`.

## Provider/control layer

Provider pool, admin control plane, and data command operate here. This layer is still transitional because it includes a temporary superuser-backed provider bridge.

## Product layer

Dashboard, portfolio, trader, history, watchlist, backtester, docs, and admin are the user-facing or operator-facing surfaces built on top of the layers above.

