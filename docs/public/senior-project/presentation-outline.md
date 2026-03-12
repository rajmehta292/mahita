---
title: Presentation Outline
slug: senior-project/presentation-outline
category: senior-project
visibility: public
audience: presenter
status: Current
order: 2
updatedAt: 2026-03-11
---

# Presentation outline

This outline is optimized for a 10–15 minute senior-project presentation.

## Slide 1: Project title and one-sentence pitch

Mahita.ai: a trading terminal and strategy research platform that connects brokerage context, backtesting, and future live testing in one system.

Goal for this slide:

- establish the product in one sentence
- do not start with bugs or caveats
- frame the project as a systems problem, not just a UI demo

## Slide 2: The problem

- retail traders face a fragmented workflow
- research, backtesting, and execution are usually split across tools
- the transition from “idea” to “trustworthy action” is messy

Goal for this slide:

- explain the user and systems problem clearly
- show why a unified platform matters

## Slide 3: Quarter 1 to Quarter 2 evolution

- show the project honestly evolving
- explain why the early Finviz/ML/Raspberry Pi ideas changed
- frame the pivots as improved problem understanding

Goal for this slide:

- make the pivots look like disciplined learning
- show that problem understanding improved over time

## Slide 4: What the platform does now

- Mahita identity and user workspaces
- Schwab developer-key onboarding
- Schwab account connection
- dashboard, portfolio, active trader, backtester prototype

Goal for this slide:

- establish concrete progress before discussing limitations
- keep the list short and credible

## Slide 5: Architecture

- auth layer
- brokerage layer
- product layer
- operator/control plane
- data and strategy subsystems

Goal for this slide:

- explain the system as layers
- emphasize separation of concerns and trust boundaries

## Slide 6: Security and trust boundaries

- user auth vs brokerage auth
- per-user account isolation
- admin control plane and audited operations
- provider bridge as a documented transitional architecture

Goal for this slide:

- show that this was treated like a financial software system
- explain that transitional architecture is documented, not hidden

## Slide 7: Demo

Show:

- landing/docs
- dashboard / account context
- settings / Schwab onboarding explanation
- backtester prototype
- docs/wiki section

Goal for this slide:

- demonstrate a coherent flow
- keep the backtester framed honestly as prototype
- use the docs portal as proof of engineering discipline

## Slide 8: What is unfinished

Be direct:

- backtester refinement
- data quality
- UI polish
- unified strategy deployment path

Goal for this slide:

- demonstrate self-awareness
- make unfinished work look like a clear roadmap, not disorder

## Slide 9: Future work

- ML strategy-lab framework
- better data pipeline
- strategy promotion from research into live monitoring/testing

Goal for this slide:

- show where the project goes next
- connect ML to the matured project direction, not the earlier vague idea

## Slide 10: Conclusion

Mahita is a functional foundation, not a finished product. The strongest result is that the architecture, trust boundaries, and future roadmap are now clearly defined.

## Speaker note

When discussing unfinished work, avoid apologizing. Instead say:

“The core engineering achievement this quarter was converging on the correct system boundaries and building a working foundation that can be refined into a trustworthy platform.”
