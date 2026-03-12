---
title: Two-Quarter Research Timeline
slug: project-overview/two-quarter-research-timeline
category: project-overview
visibility: public
audience: reviewers
status: Current
order: 2
updatedAt: 2026-03-11
---

# Two-quarter research timeline

Mahita was not built from a single frozen specification. The project evolved as the technical and product understanding improved. That evolution is part of the research story, not something to hide.

## Quarter 1: exploration and prototype framing

The first quarter focused on figuring out what problem was actually worth solving.

- A local JavaScript prototype was built using Finviz-fed market data.
- Early ML ideas were explored, but they were still vague and not yet connected to a disciplined strategy research process.
- One concept involved running individual strategies on Raspberry Pi devices with a central server coordinating them.
- That architecture was ambitious, but it added distributed-system complexity before the core research and trading workflow was stable.

The key outcome of Quarter 1 was not a production-ready platform. The key outcome was a better understanding of the problem: adding more infrastructure would not help unless the system could first evaluate strategies, manage user accounts safely, and create a trustworthy path from research to execution.

## Quarter 2: practical platform pivot

Quarter 2 shifted toward a more grounded objective:

- build a usable trading terminal,
- connect real brokerage accounts safely,
- create a user-facing system that could support backtesting and later live testing,
- document the architecture honestly enough to keep improving it.

This is where Mahita.ai emerged as the main system:

- Schwab integration replaced the earlier loosely defined brokerage ideas
- the focus moved from “many devices executing strategies” to “one coherent platform where a strategy can be researched, validated, and eventually monitored live”
- the ML concept also matured: instead of hand-wavy “AI trading,” the direction became a structured research pipeline for testing many strategy variants and summarizing results to find stronger approaches

## Why the pivots are legitimate

The objective changes were driven by engineering reality:

- a distributed execution system was premature before the strategy and account flows were correct
- ML could not be useful until the platform had cleaner data, clearer strategy definitions, and a better evaluation loop
- real brokerage integration revealed authentication, user isolation, and operator tooling problems that had to be solved before advanced automation could be trusted

That progression is the most accurate description of the project: exploration first, then convergence on a more defensible system architecture.
