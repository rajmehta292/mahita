---
title: Auth Debugging Runbook
slug: runbooks/auth-debugging
category: runbook
visibility: signed-in
audience: operators
status: Current
order: 3
updatedAt: 2026-03-11
---

# Auth debugging runbook

## First checks

- open `/api/health/auth`
- verify public origin vs localhost behavior
- verify whether Google is intentionally enabled or disabled for the current origin

## Production expectations

- Google sign-in on `https://mahita.ai`
- callback `https://mahita.ai/api/auth/callback/google`

## Demo/local expectations

- dev bypass only
- no real-user Google auth required

## If a callback fails

- verify public origin configuration
- verify tunnel availability if using a public dev hostname
- verify the app is not mixing localhost-only assumptions into public docs
