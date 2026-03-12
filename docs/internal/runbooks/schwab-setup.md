---
title: Schwab Setup Runbook
slug: runbooks/schwab-setup
category: runbook
visibility: signed-in
audience: operators
status: Current
order: 4
updatedAt: 2026-03-11
---

# Schwab setup runbook

## The three separate concepts

1. Mahita sign-in: Google for Mahita identity
2. Schwab Developer Portal: create the developer app and obtain Client ID / Client Secret
3. Schwab brokerage OAuth: authorize the real brokerage account to Mahita

## Production callback

Use:

`https://mahita.ai/schwab/callback`

## Important note

The callback URL identifies the application endpoint. User isolation comes from the Mahita session plus OAuth state, not from having unique callback URLs per user.
