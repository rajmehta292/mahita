---
title: Local Bootstrap Runbook
slug: runbooks/local-bootstrap
category: runbook
visibility: signed-in
audience: operators
status: Current
order: 1
updatedAt: 2026-03-11
---

# Local bootstrap runbook

## Fast path

```bash
./scripts/bootstrap-demo.sh
npm run dev
```

## Result

- local env file created from demo template
- Prisma generated and database initialized
- demo users seeded
- mock brokerage data enabled

## Intended use

This is the recommended setup for presentation, review, and quick onboarding.
