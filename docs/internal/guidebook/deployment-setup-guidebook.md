---
title: Deployment and Setup Guidebook
slug: guidebook/deployment-setup-guidebook
category: guidebook
visibility: signed-in
audience: operators
status: Current
order: 4
updatedAt: 2026-03-11
---

# Deployment and setup guidebook

## Current modes

### Presentation-safe demo mode

- uses dev-bypass auth
- uses mock brokerage data
- seeds presentation users and preferences
- does not require live credentials

### Live development mode

- uses real local environment configuration
- may use live auth and brokerage setup
- intended for active engineering work, not presentation safety

## Primary scripts

- `scripts/bootstrap-demo.sh`
- `scripts/package-demo-bundle.sh`
- `scripts/export-project-evidence.sh`

## Deployment caution

The presentation demo bundle is not a production deployment artifact. It is an onboarding and demonstration artifact.
