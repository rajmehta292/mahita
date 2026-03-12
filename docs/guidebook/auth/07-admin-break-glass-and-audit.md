# 07 - Admin Break-Glass And Audit

## Goal
Superuser access should be powerful but controlled.

## Current Break-Glass Model
Sensitive reveal actions require:
- `SUPERUSER` role
- recent sign-in recency check
- explicit reason
- persisted reveal grant
- audit event

## Current Data Objects
- `AdminAuditEvent`
- `AdminSecretRevealGrant`

## Expected Operator Behavior
- use reveal only when derived status is not enough
- provide a real operational reason
- treat reveal as time-bounded emergency access
- prefer status/health inspection over raw secret access whenever possible

## Current Gap
The backend model is stronger than the UI and review coverage. The current admin control plane is first-pass and still needs broader operational hardening.
