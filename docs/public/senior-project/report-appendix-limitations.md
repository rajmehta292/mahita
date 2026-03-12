---
title: Report Appendix - Limitations
slug: senior-project/report-appendix-limitations
category: senior-project
visibility: public
audience: reviewers
status: Current
order: 7
updatedAt: 2026-03-11
---

# Report appendix: limitations

Mahita is intentionally presented as a foundation, not a finished product.

## Authentication and security

- some admin/provider architecture is still transitional
- the platform still uses a temporary superuser-backed provider bridge
- role governance is stronger than before but not yet fully mature

## Data

- historical coverage and normalization are not yet complete enough to support production-grade strategy validation
- data quality guarantees are not yet at the level needed for trustworthy automated trading

## Backtester

- the current backtester is a prototype engine
- the editor/runtime path is more stable now, but strategy/runtime parity is not complete
- result confidence still depends on incomplete data and engine maturity

## UI and UX

- several surfaces are functional but still need polish, consistency, and responsiveness work
- the application has improved stability, but it still contains refinement debt

## Live trading workflow

- portfolio and trader flows exist, but a full strategy promotion and automated deployment path is not complete
- strategy automation should not be treated as production-ready

## ML direction

- the ML strategy-lab is a researched direction and partial framework concept, not a deployed system

